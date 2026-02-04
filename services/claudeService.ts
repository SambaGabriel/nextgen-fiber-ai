/**
 * Claude AI Service
 * Uses Anthropic Claude API for fast, accurate map analysis
 */

import Anthropic from '@anthropic-ai/sdk';
import { MapAnalysisResult, Language, AuditStatus, AuditResult } from '../types';

const getClient = () => new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
  dangerouslyAllowBrowser: true
});

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 9);

const BOQ_SYSTEM_PROMPT = `You are a Senior OSP (Outside Plant) Drawing Analyst specializing in fiber optic construction documents.

Your mission: Extract precise Bill of Quantities (BOQ) data from construction maps and drawings.

CRITICAL RULES:
1. ONLY report what you can clearly see/read in the document
2. Do NOT estimate or hallucinate values - if unsure, use 0
3. Look for the LEGEND/SYMBOLOGY box first to understand colors and symbols
4. Find the SUMMARY TABLE for official footage counts
5. Identify aerial vs underground sections by line style (solid vs dashed)

OUTPUT: Return ONLY valid JSON matching the required schema. No explanations.`;

const getResponseSchema = (lang: Language) => `
{
  "totalCableLength": number (total feet of cable),
  "aerialFootage": number (aerial/overhead feet),
  "undergroundFootage": number (underground/buried feet),
  "cableType": string (e.g., "144F", "288F"),
  "spanCount": number (number of spans),
  "anchorCount": number (guy anchors),
  "mstCount": number (MST terminals),
  "difficultyRating": string (project notes/summary),
  "segments": [
    {
      "id": string,
      "length": number,
      "type": "AERIAL" | "UNDERGROUND",
      "fiberType": string,
      "startNode": string,
      "endNode": string
    }
  ],
  "equipmentCounts": [
    { "name": string, "quantity": number }
  ],
  "materialList": [
    { "item": string, "quantity": number, "unit": string, "category": string }
  ],
  "financials": {
    "estimatedLaborCost": number,
    "potentialSavings": number
  },
  "detectedAnomalies": [string]
}

Language for descriptions: ${lang}`;

export const analyzeMapWithClaude = async (
  base64Data: string,
  mimeType: string,
  lang: Language = Language.PT
): Promise<MapAnalysisResult> => {
  try {
    const client = getClient();

    // Clean base64 if it has data URL prefix
    const cleanBase64 = base64Data.includes('base64,')
      ? base64Data.split('base64,')[1]
      : base64Data;

    // Determine media type for Claude
    let mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' = 'image/png';
    if (mimeType.includes('jpeg') || mimeType.includes('jpg')) {
      mediaType = 'image/jpeg';
    } else if (mimeType.includes('png')) {
      mediaType = 'image/png';
    } else if (mimeType.includes('gif')) {
      mediaType = 'image/gif';
    } else if (mimeType.includes('webp')) {
      mediaType = 'image/webp';
    }

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: BOQ_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: cleanBase64
              }
            },
            {
              type: 'text',
              text: `Analyze this fiber optic construction map and extract the BOQ data.

Return ONLY valid JSON in this exact format:
${getResponseSchema(lang)}

If you cannot determine a value, use 0 for numbers or empty string for text.`
            }
          ]
        }
      ]
    });

    // Extract text response
    const textBlock = response.content.find(block => block.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text response from Claude');
    }

    // Parse JSON from response (handle markdown code blocks)
    let jsonStr = textBlock.text;
    if (jsonStr.includes('```json')) {
      jsonStr = jsonStr.split('```json')[1].split('```')[0];
    } else if (jsonStr.includes('```')) {
      jsonStr = jsonStr.split('```')[1].split('```')[0];
    }

    const result = JSON.parse(jsonStr.trim());

    // Ensure required fields have defaults
    return {
      totalCableLength: result.totalCableLength || 0,
      aerialFootage: result.aerialFootage || 0,
      undergroundFootage: result.undergroundFootage || 0,
      cableType: result.cableType || '',
      spanCount: result.spanCount || 0,
      anchorCount: result.anchorCount || 0,
      mstCount: result.mstCount || 0,
      difficultyRating: result.difficultyRating || '',
      segments: result.segments || [],
      equipmentCounts: result.equipmentCounts || [],
      materialList: result.materialList || [],
      financials: result.financials || { estimatedLaborCost: 0, potentialSavings: 0 },
      detectedAnomalies: result.detectedAnomalies || []
    };

  } catch (error) {
    console.error('Claude Analysis Error:', error);
    throw error;
  }
};

export const analyzePhotoWithClaude = async (
  base64Data: string,
  lang: Language = Language.PT
): Promise<{
  complianceScore: number;
  issues: string[];
  summary: string;
}> => {
  try {
    const client = getClient();

    const cleanBase64 = base64Data.includes('base64,')
      ? base64Data.split('base64,')[1]
      : base64Data;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
                data: cleanBase64
              }
            },
            {
              type: 'text',
              text: `Analyze this fiber optic construction photo for quality and compliance.

Return JSON:
{
  "complianceScore": number (0-100),
  "issues": [string],
  "summary": string (brief ${lang === 'PT' ? 'Portuguese' : 'English'} description)
}

Focus on: cable routing, attachment quality, safety clearances, workmanship.`
            }
          ]
        }
      ]
    });

    const textBlock = response.content.find(block => block.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text response');
    }

    let jsonStr = textBlock.text;
    if (jsonStr.includes('```')) {
      jsonStr = jsonStr.split('```')[1].split('```')[0].replace('json', '');
    }

    return JSON.parse(jsonStr.trim());

  } catch (error) {
    console.error('Claude Photo Analysis Error:', error);
    return { complianceScore: 70, issues: [], summary: 'Analysis unavailable' };
  }
};

/**
 * Analyze construction image for audit (compatible with old API)
 */
export const analyzeConstructionImage = async (
  base64Image: string,
  lang: Language = Language.PT
): Promise<AuditResult> => {
  try {
    const client = getClient();

    const cleanBase64 = base64Image.includes('base64,')
      ? base64Image.split('base64,')[1]
      : base64Image;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
                data: cleanBase64
              }
            },
            {
              type: 'text',
              text: `You are a fiber optic construction QC inspector. Analyze this field photo.

Return JSON:
{
  "status": "COMPLIANT" | "DIVERGENT" | "CRITICAL" | "PENDING",
  "complianceScore": number (0-100),
  "detectedItems": [string] (list of detected equipment/materials),
  "issues": [string] (list of issues found),
  "aiSummary": string (${lang === 'PT' ? 'Portuguese' : 'English'} summary of findings)
}

Evaluate: cable sag, attachment quality, clearances, safety, NESC compliance, workmanship.`
            }
          ]
        }
      ]
    });

    const textBlock = response.content.find(block => block.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text response');
    }

    let jsonStr = textBlock.text;
    if (jsonStr.includes('```')) {
      jsonStr = jsonStr.split('```')[1].split('```')[0].replace('json', '');
    }

    const result = JSON.parse(jsonStr.trim());

    // Map status string to AuditStatus enum
    const statusMap: Record<string, AuditStatus> = {
      'COMPLIANT': AuditStatus.COMPLIANT,
      'DIVERGENT': AuditStatus.DIVERGENT,
      'CRITICAL': AuditStatus.CRITICAL,
      'PENDING': AuditStatus.PENDING
    };

    return {
      id: generateId(),
      timestamp: new Date().toISOString(),
      status: statusMap[result.status] || AuditStatus.PENDING,
      complianceScore: result.complianceScore || 0,
      detectedItems: result.detectedItems || [],
      issues: result.issues || [],
      aiSummary: result.aiSummary || '',
      auditedBy: 'Claude AI',
      companyName: 'System'
    };

  } catch (error) {
    console.error('Claude Construction Analysis Error:', error);
    return {
      id: generateId(),
      timestamp: new Date().toISOString(),
      status: AuditStatus.PENDING,
      complianceScore: 0,
      detectedItems: [],
      issues: ['Analysis failed'],
      aiSummary: 'Unable to analyze image',
      auditedBy: 'System',
      companyName: 'System'
    };
  }
};

/**
 * Analyze map/BOQ (compatible with old API name)
 */
export const analyzeMapBoQ = analyzeMapWithClaude;

/**
 * Create chat session with Claude
 */
export const createChatSession = (lang: Language = Language.PT) => {
  const client = getClient();

  const systemPrompt = lang === Language.PT
    ? 'Você é um assistente especializado em construção de fibra óptica. Responda em português de forma técnica e precisa.'
    : lang === Language.ES
      ? 'Eres un asistente especializado en construcción de fibra óptica. Responde en español de forma técnica y precisa.'
      : 'You are an assistant specialized in fiber optic construction. Respond in English technically and precisely.';

  let conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [];

  return {
    sendMessage: async (message: string): Promise<string> => {
      conversationHistory.push({ role: 'user', content: message });

      const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        system: systemPrompt,
        messages: conversationHistory
      });

      const textBlock = response.content.find(block => block.type === 'text');
      const assistantMessage = textBlock && textBlock.type === 'text' ? textBlock.text : 'No response';

      conversationHistory.push({ role: 'assistant', content: assistantMessage });

      return assistantMessage;
    },
    reset: () => {
      conversationHistory = [];
    }
  };
};

/**
 * Field assistant session
 */
export const createFieldAssistantSession = createChatSession;

export const claudeService = {
  analyzeMap: analyzeMapWithClaude,
  analyzePhoto: analyzePhotoWithClaude,
  analyzeConstruction: analyzeConstructionImage,
  createChat: createChatSession
};

export default claudeService;
