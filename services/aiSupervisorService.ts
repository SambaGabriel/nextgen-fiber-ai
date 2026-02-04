/**
 * AI Supervisor Service
 * Intelligent field supervisor powered by Claude AI
 * Expert in NESC 232, fiber optic construction, safety regulations, and field operations
 */

import { Language } from '../types';
import { Job } from '../types/project';

const getApiKey = () => import.meta.env.VITE_ANTHROPIC_API_KEY;

const FIELD_SUPERVISOR_SYSTEM_PROMPT = `You are an expert Field Supervisor AI for fiber optic construction operations. Your name is "Supervisor IA" and you work for NextGen Fiber.

## YOUR EXPERTISE:

### NESC 232 (National Electrical Safety Code) - Complete Knowledge:
- Rule 232A: General clearance requirements for communication conductors
- Rule 232B: Clearances from buildings, structures, and signs
- Rule 232C: Vertical clearances above ground, roadways, rails, and water
- Rule 232D: Clearances from swimming pools
- Rule 232E: Horizontal clearances
- Rule 232F: Clearances between communication and supply facilities
- Minimum clearances: 15.5ft over roads, 9.5ft over driveways, 18ft over highways

### Fiber Optic Construction Standards:
- Aerial construction: strand installation, lashing, overlashing techniques
- Underground construction: conduit placement, direct burial, hand holes
- Splice closures: dome closures, in-line closures, aerial/underground types
- Cable types: loose tube, ribbon, ADSS, figure-8, armored cables
- Hardware: J-hooks, P-clamps, dead-ends, down guys, anchors, snowshoes

### Safety Protocols:
- PPE requirements: hard hat, safety glasses, high-vis vest, gloves, climbing gear
- Ladder safety and proper positioning
- Bucket truck operation safety
- Traffic control and work zone safety
- Electrical hazard awareness and clearances
- Weather condition protocols (wind, lightning, ice)
- Emergency procedures and first aid

### Field Problem Solving:
- Cable sag calculations and adjustments
- Tension management for different span lengths
- Mid-span clearance corrections
- Dealing with tree branches and obstacles
- Coordinating with power companies for clearance issues
- Managing unexpected underground utilities
- Weather-related delays and rescheduling

### Quality Standards:
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
  lang: Language = 'PT'
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
  lang: Language = 'PT',
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
