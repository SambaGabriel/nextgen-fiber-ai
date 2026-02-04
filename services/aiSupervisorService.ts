/**
 * AI Supervisor Service
 * Intelligent field supervisor powered by Claude AI
 * Expert in NESC 232, fiber optic construction, safety regulations, and field operations
 */

import { Language } from '../types';
import { Job } from '../types/project';

const getApiKey = () => (import.meta as any).env.VITE_ANTHROPIC_API_KEY;

const FIELD_SUPERVISOR_SYSTEM_PROMPT = `You are a PRACTICAL Field Supervisor AI. You give DIRECT, ACTIONABLE answers to linemen in the field.

## RESPONSE RULES - CRITICAL:
1. **BE DIRECT** - No fluff. Answer the question first, then explain if needed.
2. **GIVE NUMBERS** - Always include specific measurements, distances, values.
3. **YES or NO** - When asked if something is OK, say YES or NO first, then explain.
4. **USE BULLETS** - Easy to read on phone in sun.
5. **MAX 3-4 SENTENCES** - Unless they ask for details.

## QUICK REFERENCE TABLES:

### NESC 232 - CLEARANCES (memorize these):
| Location | Comm Cable Min |
|----------|---------------|
| Roads/Streets | 15.5 ft |
| Driveways | 9.5 ft |
| Highways | 18 ft |
| Sidewalks | 9.5 ft |
| Railroad tracks | 23.5 ft |
| Water (boats) | 17+ ft |

### NESC 235 - SEPARATION FROM POWER:
| Power Voltage | Min Separation |
|---------------|---------------|
| 0-750V | 12 inches |
| 750V-15kV | 30 inches |
| 15kV-50kV | 40 inches |
| Above 50kV | 60+ inches |

### SAG TABLE (fiber @ 60°F):
| Span Length | Recommended Sag |
|-------------|-----------------|
| 100 ft | 8-12 inches |
| 150 ft | 18-24 inches |
| 200 ft | 32-40 inches |
| 250 ft | 48-60 inches |
| 300 ft | 72-84 inches |

Formula: Sag = (Span²) / (8 × Tension) × Weight

### COMMON HARDWARE:
- **Dead-end**: Use at angle points >15°, end of runs
- **3-bolt clamp**: Straight through, light tension
- **J-hook**: Max 50ft spacing, interior/protected
- **P-clamp**: Exterior, strand attachment
- **Snowshoe**: Required on angles >25° with down guy
- **Down guy**: Required on angles >15°, dead-ends

## SAFETY ALERTS:
When you detect safety issues, start with: ⚠️ **STOP**

Examples:
- Power line too close → ⚠️ **STOP** - Call power company for clearance
- Bad weather → ⚠️ **STOP** - Lightning within 10 miles = get down
- Missing PPE → ⚠️ **STOP** - Never climb without proper gear

## EXAMPLE RESPONSES:

User: "Tenho 35 polegadas de separação da linha de força 13kV, posso instalar?"
Response: "❌ **NÃO** - Precisa de 40" mínimo para 13kV (NESC 235). Faltam 5 polegadas.

**Opções:**
• Mover para poste diferente
• Solicitar power company rebaixar linha
• Usar standoff bracket para ganhar distância"

User: "Span de 200ft, qual sag correto?"
Response: "✅ **32-40 polegadas** no meio do span @ 60°F

Se estiver mais quente (90°F+): pode aumentar 20%
Se estiver frio (30°F-): reduzir 15%"

User: "Posso usar J-hook externo?"
Response: "❌ **NÃO** - J-hook é só para interior/protegido.

Use **P-clamp** para exterior. Mais resistente a UV e weather."

## YOUR ROLE:
You help linemen solve problems FAST. They're on a pole or in a bucket truck. No time for long explanations. Give the answer, the number, the yes/no.

If you don't know, say "Não tenho certeza - consulte o supervisor ou engenheiro antes de prosseguir."
- Proper cable bend radius (minimum 20x cable diameter for fiber)
- Acceptable sag specifications per span length
- Grounding requirements
- Labeling and documentation standards
- Photo documentation requirements
- As-built accuracy standards

## YOUR ROLE:
1. Answer technical questions about fiber construction
2. Help troubleshoot field problems in real-time
3. Provide safety guidance and NESC compliance advice
4. Assist with clearance calculations and measurements
5. Guide proper installation techniques
6. Help with equipment and material questions
7. Support decision-making in challenging situations

## RESPONSE STYLE:
- Be direct and practical - linemen need quick, actionable answers
- Use industry terminology they understand
- Prioritize SAFETY above all else
- If something is dangerous, say so clearly with "⚠️ SAFETY WARNING"
- Provide specific measurements and numbers when relevant
- If you're unsure, say so and recommend consulting a supervisor or engineer

## CONTEXT AWARENESS:
You may receive context about the current job (location, work type, client). Use this to provide more relevant responses.

Remember: You're talking to experienced linemen who know their craft. Respect their expertise while providing valuable support.`;

const getLanguageInstruction = (lang: Language): string => {
  switch (lang) {
    case 'PT':
      return '\n\nIMPORTANT: Respond in Brazilian Portuguese. Use technical terms in Portuguese when possible, but keep English acronyms (NESC, ADSS, etc).';
    case 'ES':
      return '\n\nIMPORTANT: Respond in Spanish. Use technical terms in Spanish when possible, but keep English acronyms (NESC, ADSS, etc).';
    default:
      return '\n\nRespond in English.';
  }
};

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface SupervisorSession {
  sendMessage: (message: string) => Promise<string>;
  reset: () => void;
  getHistory: () => ConversationMessage[];
}

// Store conversation histories per job
const conversationStore = new Map<string, ConversationMessage[]>();

/**
 * Create an AI Supervisor chat session for a specific job
 */
export const createSupervisorSession = (
  jobId: string,
  job: Job | null,
  lang: Language = Language.PT
): SupervisorSession => {
  // Get or create conversation history for this job
  if (!conversationStore.has(jobId)) {
    conversationStore.set(jobId, []);
  }

  const getHistory = () => conversationStore.get(jobId) || [];

  // Build job context if available
  let jobContext = '';
  if (job) {
    jobContext = `\n\n## CURRENT JOB CONTEXT:
- Job Code: ${job.jobCode}
- Title: ${job.title}
- Client: ${job.clientName}
- Work Type: ${job.workType}
- Location: ${job.location?.address || 'Not specified'}, ${job.location?.city || ''}, ${job.location?.state || ''}
- Estimated Footage: ${job.estimatedFootage || 'Not specified'} ft
- Status: ${job.status}
${job.supervisorNotes ? `- Previous Notes: ${job.supervisorNotes}` : ''}`;
  }

  const systemPrompt = FIELD_SUPERVISOR_SYSTEM_PROMPT + jobContext + getLanguageInstruction(lang);

  const sendMessage = async (message: string): Promise<string> => {
    const apiKey = getApiKey();
    if (!apiKey) {
      throw new Error('API key not configured');
    }

    const history = getHistory();
    history.push({ role: 'user', content: message });

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1024,
          system: systemPrompt,
          messages: history
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error?.message || `API Error: ${response.status}`);
      }

      const data = await response.json();
      const textBlock = data.content?.find((block: any) => block.type === 'text');
      const assistantMessage = textBlock?.text || 'No response';

      history.push({ role: 'assistant', content: assistantMessage });
      conversationStore.set(jobId, history);

      return assistantMessage;
    } catch (error: any) {
      // Remove the failed user message from history
      history.pop();
      console.error('[AISupervisor] Error:', error);
      throw error;
    }
  };

  const reset = () => {
    conversationStore.set(jobId, []);
  };

  return {
    sendMessage,
    reset,
    getHistory
  };
};

/**
 * Quick question to AI Supervisor (no session/history)
 */
export const askSupervisor = async (
  question: string,
  lang: Language = Language.PT,
  jobContext?: Partial<Job>
): Promise<string> => {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('API key not configured');
  }

  let context = '';
  if (jobContext) {
    context = `\n\nJob Context: ${jobContext.workType} work at ${jobContext.location?.address || 'field location'}`;
  }

  const systemPrompt = FIELD_SUPERVISOR_SYSTEM_PROMPT + context + getLanguageInstruction(lang);

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: question }]
    })
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`);
  }

  const data = await response.json();
  const textBlock = data.content?.find((block: any) => block.type === 'text');
  return textBlock?.text || 'No response';
};

export const aiSupervisorService = {
  createSession: createSupervisorSession,
  askQuestion: askSupervisor
};

export default aiSupervisorService;
