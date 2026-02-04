/**
 * Claude AI Service
 * Uses Anthropic Claude API for fast, accurate map analysis
 */

import Anthropic from '@anthropic-ai/sdk';
import { MapAnalysisResult, Language } from '../types';

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

export const claudeService = {
  analyzeMap: analyzeMapWithClaude,
  analyzePhoto: analyzePhotoWithClaude
};

export default claudeService;
