/**
 * Claude Map Analyzer Service
 * Calls the backend API which uses Claude for analysis
 */

export interface FiberMapAnalysisResult {
  header: {
    projectId: string;
    location: string;
    fsa: string;
    pageNumber: number;
    totalPages: number;
    permits: string[];
    contractor: string;
    confidence: number;
  };
  cables: {
    id: string;
    cableType: string;
    fiberCount: number;
    category: string;
    confidence: number;
  }[];
  spans: {
    lengthFt: number;
    startPole: string;
    endPole: string;
    gridRef: string;
    isLongSpan: boolean;
    confidence: number;
  }[];
  equipment: {
    id: string;
    type: string;
    subType: string;
    size: string;
    slackLength: number | null;
    dimensions: string;
    gpsLat: number | null;
    gpsLng: number | null;
    confidence: number;
  }[];
  gpsPoints: {
    lat: number;
    lng: number;
    label: string;
    confidence: number;
  }[];
  poles: {
    poleId: string;
    attachmentHeight: string;
    hasAnchor: boolean;
    gridRef: string;
    confidence: number;
  }[];
  totals: {
    totalAerialFt: number;
    totalUndergroundFt: number;
    totalCableFt: number;
    spanCount: number;
    anchorCount: number;
    spliceCount: number;
    hubCount: number;
    slackloopCount: number;
    pedestalCount: number;
    poleCount: number;
  };
  validation: {
    isValid: boolean;
    overallConfidence: number;
    checks: {
      name: string;
      passed: boolean;
      message: string;
      expected?: string;
      actual?: string;
    }[];
    warnings: string[];
    errors: string[];
  };
  metadata: {
    analyzedAt: string;
    engineVersion: string;
    modelUsed: string;
    processingTimeMs: number;
    pageCount: number;
  };
}

interface AnalyzeResponse {
  success: boolean;
  result?: FiberMapAnalysisResult;
  error?: string;
}

const ANTHROPIC_API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY;

const SYSTEM_PROMPT = `You are an expert fiber optic OSP (Outside Plant) engineer analyzing construction maps. Your job is to extract EVERY piece of data with 100% accuracy.

## CRITICAL: EXTRACT EVERYTHING
1. READ THE ENTIRE DOCUMENT - every page, every corner, every table
2. FIND THE LEGEND/SYMBOLOGY first - understand all colors, line types, symbols
3. FIND THE SUMMARY/TOTALS TABLE - this has the official counts
4. EXTRACT EVERY SPAN with exact footage shown on the map
5. EXTRACT EVERY POLE ID (formats: MRE#xxx, P-xxx, POLE xxx, etc.)
6. EXTRACT ALL EQUIPMENT (MST, splice closures, pedestals, handholes, etc.)

## WHERE TO LOOK FOR DATA:
- Title block: Project ID, location, FSA, contractor, permits
- Legend box: Cable types, colors, symbols explanation
- Summary table: Total footage (aerial, underground), counts
- Along cable routes: Span distances (like "240'" or "292 FT")
- At poles: Pole IDs, anchor symbols (triangle/A), heights
- Equipment symbols: MST (circles), splices (X), pedestals (squares)

## SPAN EXTRACTION RULES:
- Look for numbers with ' or FT or feet near cable lines
- Each segment between poles is a span
- Sum ALL spans to get total footage
- Common formats: "240'" or "240 FT" or "240ft"

## POLE EXTRACTION RULES:
- Pole IDs are usually: MRE#301, P-4521, POLE 123
- Check for anchor symbols (A, triangle, guy wire)
- Note attachment heights if shown (like "24'" or "28'")

## EQUIPMENT TO FIND:
- MST (Multi-Service Terminal) - usually circles
- Splice closures - X marks or specific symbols
- Pedestals - small squares, usually underground
- Handholes - rectangles
- Slack loops/coils - curved symbols
- Anchors/guy wires - triangles or "A"

Return ONLY valid JSON:
{
  "header": { "projectId": "string", "location": "string", "fsa": "string", "pageNumber": 1, "totalPages": 1, "permits": ["string"], "contractor": "string", "confidence": 0.95 },
  "cables": [{ "id": "CAB-1", "cableType": "144F", "fiberCount": 144, "category": "AERIAL/UNDERGROUND", "confidence": 0.95 }],
  "spans": [{ "lengthFt": 240, "startPole": "MRE#301", "endPole": "MRE#302", "gridRef": "A1", "isLongSpan": false, "confidence": 0.95 }],
  "equipment": [{ "id": "EQ-1", "type": "MST/SPLICE/PEDESTAL/HANDHOLE/SLACKLOOP", "subType": "string", "size": "string", "slackLength": null, "dimensions": "", "gpsLat": null, "gpsLng": null, "confidence": 0.95 }],
  "gpsPoints": [{ "lat": 0.0, "lng": 0.0, "label": "string", "confidence": 0.95 }],
  "poles": [{ "poleId": "MRE#301", "attachmentHeight": "24'", "hasAnchor": true, "gridRef": "A1", "confidence": 0.95 }],
  "totals": { "totalAerialFt": 0, "totalUndergroundFt": 0, "totalCableFt": 0, "spanCount": 0, "anchorCount": 0, "spliceCount": 0, "hubCount": 0, "slackloopCount": 0, "pedestalCount": 0, "poleCount": 0 },
  "validation": { "isValid": true, "overallConfidence": 0.95, "checks": [{"name": "string", "passed": true, "message": "string"}], "warnings": [], "errors": [] },
  "metadata": { "analyzedAt": "", "engineVersion": "2.0", "modelUsed": "claude-sonnet-4", "processingTimeMs": 0, "pageCount": 1 }
}

IMPORTANT:
- Do NOT estimate or guess - only report what you can clearly see
- If totals table exists, use those numbers
- If no totals table, SUM all individual spans
- Include EVERY pole, EVERY span, EVERY piece of equipment`;

/**
 * Analyze a fiber map using Claude AI directly
 */
export async function analyzeMapWithClaude(
  imageBase64: string,
  mediaType: string = 'image/png',
  apiKey?: string,
  maxPages: number = 10
): Promise<FiberMapAnalysisResult> {
  const cleanBase64 = imageBase64.includes('base64,')
    ? imageBase64.split('base64,')[1]
    : imageBase64;

  const key = apiKey || ANTHROPIC_API_KEY;
  const isPDF = mediaType.includes('pdf');

  console.log(`[ClaudeAnalyzer] Sending to Claude API: type=${isPDF ? 'PDF' : 'image'}, size=${(cleanBase64.length * 0.75 / 1024 / 1024).toFixed(2)}MB`);

  const contentBlock = isPDF
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: cleanBase64 } }
    : { type: 'image', source: { type: 'base64', media_type: mediaType, data: cleanBase64 } };

  const startTime = Date.now();

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: [
          contentBlock,
          { type: 'text', text: `Analyze this fiber optic construction map COMPLETELY.

STEP 1: Find and read the LEGEND/SYMBOLOGY box
STEP 2: Find and read the SUMMARY TABLE with totals
STEP 3: Extract EVERY span length shown (numbers with ' or FT)
STEP 4: Extract EVERY pole ID (MRE#xxx, P-xxx format)
STEP 5: Extract ALL equipment (MST, splices, pedestals, anchors)
STEP 6: Verify totals match sum of spans

Return complete JSON with ALL data found. Do not skip anything.` }
        ]
      }]
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    console.error('[ClaudeAnalyzer] API Error:', response.status, err);

    // Handle rate limit error
    if (response.status === 429 || err?.error?.message?.includes('rate limit')) {
      throw new Error('⏳ Limite de requisições atingido. Aguarde 1 minuto e tente novamente.');
    }

    // Handle token limit error
    if (err?.error?.message?.includes('token')) {
      throw new Error('📄 PDF muito grande. Tente com um arquivo menor (máx ~5MB recomendado para plano gratuito).');
    }

    throw new Error(err?.error?.message || `Erro da API: ${response.status}`);
  }

  const data = await response.json();
  const processingTime = Date.now() - startTime;
  console.log(`[ClaudeAnalyzer] Response received in ${processingTime}ms`);

  const textBlock = data.content?.find((b: any) => b.type === 'text');
  if (!textBlock?.text) throw new Error('No response from Claude');

  let jsonStr = textBlock.text;

  // Try to extract JSON from various formats
  if (jsonStr.includes('```json')) {
    jsonStr = jsonStr.split('```json')[1].split('```')[0];
  } else if (jsonStr.includes('```')) {
    jsonStr = jsonStr.split('```')[1].split('```')[0];
  }

  // Try to find JSON object boundaries
  const jsonStart = jsonStr.indexOf('{');
  const jsonEnd = jsonStr.lastIndexOf('}');
  if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
    jsonStr = jsonStr.substring(jsonStart, jsonEnd + 1);
  }

  let result;
  try {
    result = JSON.parse(jsonStr.trim());
  } catch (parseError) {
    console.error('[ClaudeAnalyzer] JSON Parse Error:', parseError);
    console.error('[ClaudeAnalyzer] Raw response:', textBlock.text.substring(0, 500));

    // Try to fix common JSON issues
    let fixedJson = jsonStr
      .replace(/,\s*}/g, '}')  // Remove trailing commas
      .replace(/,\s*]/g, ']')  // Remove trailing commas in arrays
      .replace(/'/g, '"')      // Replace single quotes
      .replace(/\n/g, ' ')     // Remove newlines
      .trim();

    try {
      result = JSON.parse(fixedJson);
    } catch {
      throw new Error('Erro ao processar resposta do Claude. Tente novamente ou use uma imagem mais clara.');
    }
  }
  result.metadata = result.metadata || {};
  result.metadata.analyzedAt = new Date().toISOString();
  result.metadata.processingTimeMs = processingTime;
  result.metadata.modelUsed = 'claude-sonnet-4-20250514';

  return result as FiberMapAnalysisResult;
}

/**
 * Check if the map analyzer service is healthy
 */
export async function checkMapAnalyzerHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/map-analyzer/health`);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Export results to CSV format
 */
export function exportToCSV(result: FiberMapAnalysisResult): string {
  const lines: string[] = [];
  lines.push('Type,ID,Value,Unit,Confidence,Notes');

  // Spans
  result.spans.forEach((s, i) => {
    lines.push(`Span,SPAN_${i},${s.length_ft},FT,${s.confidence},"${s.start_pole || ''} to ${s.end_pole || ''}"`);
  });

  // Cables
  result.cables.forEach(c => {
    lines.push(`Cable,${c.id},${c.fiber_count},Fiber,${c.confidence},${c.cable_type}`);
  });

  // Equipment
  result.equipment.forEach(e => {
    lines.push(`Equipment,${e.id},${e.type},,${e.confidence},${e.sub_type || ''}`);
  });

  // Poles
  result.poles.forEach(p => {
    lines.push(`Pole,${p.pole_id},${p.has_anchor ? 'With Anchor' : 'No Anchor'},,${p.confidence},${p.grid_ref || ''}`);
  });

  return lines.join('\n');
}

/**
 * Export results to JSON format
 */
export function exportToJSON(result: FiberMapAnalysisResult): string {
  return JSON.stringify(result, null, 2);
}
