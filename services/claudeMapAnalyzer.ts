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

const API_BASE = 'http://localhost:8000/api/v1';

/**
 * Convert snake_case keys to camelCase recursively
 */
function snakeToCamel(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(snakeToCamel);
  if (typeof obj !== 'object') return obj;

  const result: any = {};
  for (const key in obj) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    result[camelKey] = snakeToCamel(obj[key]);
  }
  return result;
}

/**
 * Analyze a fiber map using Claude AI via the backend API
 */
export async function analyzeMapWithClaude(
  imageBase64: string,
  mediaType: string = 'image/png',
  apiKey?: string,
  maxPages: number = 10
): Promise<FiberMapAnalysisResult> {
  // Clean base64 if it has data URL prefix
  const cleanBase64 = imageBase64.includes('base64,')
    ? imageBase64.split('base64,')[1]
    : imageBase64;

  console.log(`[ClaudeAnalyzer] Sending request: mediaType=${mediaType}, maxPages=${maxPages}, size=${cleanBase64.length} chars`);

  const response = await fetch(`${API_BASE}/map-analyzer/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      image_base64: cleanBase64,
      media_type: mediaType,
      api_key: apiKey,
      max_pages: maxPages,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API request failed: ${response.status} - ${errorText}`);
  }

  const data: AnalyzeResponse = await response.json();

  if (!data.success || !data.result) {
    throw new Error(data.error || 'Analysis failed');
  }

  // Convert snake_case to camelCase for TypeScript conventions
  return snakeToCamel(data.result) as FiberMapAnalysisResult;
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
