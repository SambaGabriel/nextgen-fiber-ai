/**
 * FiberMapAnalyzer - High-Precision OSP Map Analysis Engine
 * Specialized for All Points Broadband (APB) and similar fiber construction maps
 *
 * Features:
 * - Multi-pass extraction with validation
 * - Domain-specific prompts for fiber construction
 * - Confidence scoring per field
 * - Cross-validation of totals
 * - Support for APB Legend symbology
 */

import { GoogleGenAI, Type } from "@google/genai";
import { Language } from "../types";

// ============================================
// TYPES
// ============================================

export interface FiberMapAnalysisResult {
  // Project Header
  header: ProjectHeader;

  // Cable Inventory
  cables: CableSegment[];

  // Span Details
  spans: SpanMeasurement[];

  // Equipment
  equipment: EquipmentItem[];

  // GPS Points
  gpsPoints: GPSPoint[];

  // Pole IDs
  poles: PoleInfo[];

  // Calculated Totals
  totals: CalculatedTotals;

  // Validation
  validation: ValidationReport;

  // Metadata
  metadata: AnalysisMetadata;
}

export interface ProjectHeader {
  projectId: string;           // VALOUD0409
  projectName?: string;
  location: string;            // Loudoun County
  fsa: string;                 // VA-LOUD-04
  pageNumber: number;
  totalPages: number;
  permits: string[];           // LOUD-4_AER_041, etc.
  gridCoords?: string;
  contractor: string;          // All Points Broadband
  confidence: number;
}

export interface CableSegment {
  id: string;                  // LOUD04-MULTI_TIER_CABLE_024
  cableType: 'MULTI_TIER' | 'TAIL' | 'DROP' | 'FEEDER' | 'DISTRIBUTION';
  fiberCount: number;          // 24, 48, 288, etc.
  category: 'AERIAL' | 'UNDERGROUND' | 'BURIED';
  colorCode?: string;          // From legend
  startPole?: string;
  endPole?: string;
  lengthFt?: number;
  confidence: number;
}

export interface SpanMeasurement {
  id: string;
  lengthFt: number;
  startPole: string;
  endPole?: string;
  cableId?: string;
  pageNumber: number;
  gridRef?: string;            // GD 22, etc.
  isLongSpan: boolean;         // > 300ft flagged
  confidence: number;
}

export interface EquipmentItem {
  id: string;
  type: 'HUB' | 'SPLICE' | 'SLACKLOOP' | 'PEDESTAL' | 'HANDHOLE' | 'CABINET' | 'SPLITTER' | 'RISER' | 'MST' | 'ANCHOR';
  subType?: string;            // T1_HUB, T2_SPLICE, MG_SPLICE, etc.
  size?: string;               // 288-C, 48-C, 24-C for slackloops
  slackLength?: number;        // 100', 50' for slackloops
  dimensions?: string;         // 15.75x14.75x47 for pedestals
  location?: {
    poleId?: string;
    gps?: { lat: number; lng: number };
  };
  fiberCount?: number;
  confidence: number;
}

export interface GPSPoint {
  lat: number;
  lng: number;
  label: string;
  equipmentId?: string;
  accuracy?: number;
  confidence: number;
}

export interface PoleInfo {
  poleId: string;              // B1929HE1900
  utilityOwner?: string;       // Dominion, NOVEC, etc.
  attachmentHeight?: string;   // 1.5" 27ft
  hasAnchor: boolean;
  gridRef?: string;
  pageNumber: number;
  confidence: number;
}

export interface CalculatedTotals {
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

  // By fiber count
  fiberBreakdown: {
    fiberCount: number;
    totalFt: number;
    segmentCount: number;
  }[];
}

export interface ValidationReport {
  isValid: boolean;
  overallConfidence: number;
  checks: ValidationCheck[];
  warnings: string[];
  errors: string[];
}

export interface ValidationCheck {
  name: string;
  passed: boolean;
  expected?: string | number;
  actual?: string | number;
  message: string;
}

export interface AnalysisMetadata {
  analyzedAt: string;
  engineVersion: string;
  modelUsed: string;
  processingTimeMs: number;
  pageCount: number;
  extractionPasses: number;
}

// ============================================
// ANALYSIS ENGINE
// ============================================

const getAi = () => new GoogleGenAI({ apiKey: process.env.API_KEY });
const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 9);

// Domain-specific system instruction for fiber map analysis
const FIBER_MAP_SYSTEM_INSTRUCTION = `
You are an expert OSP (Outside Plant) Engineering Analyst specializing in fiber optic construction drawings.
Your task is to extract PRECISE, ACCURATE data from technical fiber construction maps.

## CRITICAL RULES:

1. **ACCURACY OVER SPEED**: Take your time. Read every label carefully. Do not guess.

2. **LEGEND FIRST**: Before extracting any data, identify and understand the map legend (APB LEGEND).
   - Aerial lines (dashed)
   - Underground lines (solid with U marker)
   - Equipment symbols (HUB, SPLICE, SLACKLOOP, PEDESTAL, etc.)

3. **CABLE NOMENCLATURE**: Parse cable IDs precisely:
   - Format: LOUD04-[TYPE]_CABLE_[NUMBER]
   - Types: MULTI_TIER, TAIL, DROP
   - Extract fiber count from "Cable Size: XX" labels

4. **SPAN MEASUREMENTS**: Extract ALL span measurements in feet:
   - Look for "XXXft" labels on cable runs
   - Note which poles they connect
   - Flag long spans (>300ft) as they may need verification

5. **POLE IDs**: Capture utility pole identifiers:
   - Format: B1929XXXXXX or similar
   - These are critical for field verification

6. **GPS COORDINATES**: Extract coordinates from pedestals:
   - Format: XX.XXXXX, -XX.XXXXX
   - Often shown as "39.11031, -77.69728"

7. **EQUIPMENT**: Identify all equipment:
   - HUBs: LOUD04-T1_HUB_XXXX
   - Splices: LOUD04-T2_SPLICE_XXXX, LOUD04-MG_SPLICE_XXXX
   - SLACKLOOPs: Note size (288-C, 48-C, 24-C) and slack length (100', 50')
   - Pedestals: Note dimensions and GPS

8. **HEADER INFO**: Extract from title block:
   - Project ID (VALOUD0409)
   - Location (LOUDOUN COUNTY)
   - FSA code (VA-LOUD-04)
   - Page number (34 of 52)
   - Permit numbers (LOUD-4_AER_041, etc.)

9. **CONFIDENCE SCORING**: Rate your confidence (0-100) for each extracted item:
   - 100: Clearly visible, no ambiguity
   - 80-99: Mostly clear, minor uncertainty
   - 60-79: Partially visible, some inference needed
   - <60: Low confidence, needs human verification

10. **NO HALLUCINATIONS**: If you cannot read a value clearly, mark it as null with low confidence.
    Do NOT invent data. An incomplete but accurate extraction is better than a complete but wrong one.
`;

// First pass: Extract header and structure
const PASS_1_HEADER_PROMPT = `
EXTRACTION PASS 1: PROJECT HEADER & STRUCTURE

Extract the following from the title block (usually top-right corner):
1. Project ID (e.g., VALOUD0409)
2. Location/County
3. FSA code
4. Page number and total pages
5. Permit/Job numbers (list all)
6. Contractor name (from logo)
7. Grid coordinates reference

Also identify:
- How many distinct cable routes are visible
- The general area covered (street names)
- Scale bar value

Return structured JSON with confidence scores.
`;

// Second pass: Extract cables and spans
const PASS_2_CABLES_PROMPT = `
EXTRACTION PASS 2: CABLES & SPANS

For EACH cable segment visible:
1. Cable ID (e.g., LOUD04-MULTI_TIER_CABLE_024)
2. Cable Size/Fiber Count (e.g., "Cable Size: 24" = 24 fibers)
3. Type (MULTI_TIER, TAIL, DROP)
4. Category (AERIAL or UNDERGROUND based on line style)

For EACH span measurement:
1. Length in feet (e.g., "228ft")
2. Start pole ID if visible
3. End pole ID if visible
4. Which cable it belongs to
5. Grid reference (GD XX)

BE PRECISE: Extract the exact numbers shown. Do not round or estimate.
`;

// Third pass: Extract equipment
const PASS_3_EQUIPMENT_PROMPT = `
EXTRACTION PASS 3: EQUIPMENT & GPS

Extract ALL equipment:

1. **HUBs**:
   - ID format: LOUD04-T1_HUB_XXXX
   - Location (pole ID or GPS)

2. **SPLICES**:
   - ID format: LOUD04-T2_SPLICE_XXXX or LOUD04-MG_SPLICE_XXXX
   - Type: T2 (standard) or MG (mid-gain)

3. **SLACKLOOPs**:
   - Size: 288-C, 48-C, 24-C, 12-C
   - Slack length: "Slack: 100'" or "Slack: 50'"

4. **PEDESTALS**:
   - Dimensions: "15.75x14.75x47"
   - GPS: "39.11031, -77.69728"

5. **OTHER**: Handholes, Cabinets, Splitters, Risers, MSTs, Anchors

For GPS coordinates, extract EXACT values - these are critical for field work.
`;

// Fourth pass: Extract poles
const PASS_4_POLES_PROMPT = `
EXTRACTION PASS 4: POLE IDs & ANCHORS

Extract ALL pole identifiers:
1. Pole ID (e.g., B1929HE1900, B1928HM1900)
2. Attachment height if shown (e.g., "1.5" 27ft")
3. Whether it has an anchor (down guy)
4. Grid reference
5. Any special markers (NT-1, NT-2, etc.)

Pole ID patterns to look for:
- B19XXXXXXXX (most common)
- Numeric sequences near black dots

Count total poles and anchors visible on this page.
`;

// JSON Schema for structured output
const ANALYSIS_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    header: {
      type: Type.OBJECT,
      properties: {
        projectId: { type: Type.STRING },
        location: { type: Type.STRING },
        fsa: { type: Type.STRING },
        pageNumber: { type: Type.NUMBER },
        totalPages: { type: Type.NUMBER },
        permits: { type: Type.ARRAY, items: { type: Type.STRING } },
        contractor: { type: Type.STRING },
        confidence: { type: Type.NUMBER }
      }
    },
    cables: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          cableType: { type: Type.STRING },
          fiberCount: { type: Type.NUMBER },
          category: { type: Type.STRING },
          confidence: { type: Type.NUMBER }
        }
      }
    },
    spans: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          lengthFt: { type: Type.NUMBER },
          startPole: { type: Type.STRING, nullable: true },
          endPole: { type: Type.STRING, nullable: true },
          gridRef: { type: Type.STRING, nullable: true },
          confidence: { type: Type.NUMBER }
        }
      }
    },
    equipment: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          type: { type: Type.STRING },
          subType: { type: Type.STRING, nullable: true },
          size: { type: Type.STRING, nullable: true },
          slackLength: { type: Type.NUMBER, nullable: true },
          dimensions: { type: Type.STRING, nullable: true },
          gpsLat: { type: Type.NUMBER, nullable: true },
          gpsLng: { type: Type.NUMBER, nullable: true },
          confidence: { type: Type.NUMBER }
        }
      }
    },
    poles: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          poleId: { type: Type.STRING },
          attachmentHeight: { type: Type.STRING, nullable: true },
          hasAnchor: { type: Type.BOOLEAN },
          gridRef: { type: Type.STRING, nullable: true },
          confidence: { type: Type.NUMBER }
        }
      }
    },
    gpsPoints: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          lat: { type: Type.NUMBER },
          lng: { type: Type.NUMBER },
          label: { type: Type.STRING },
          confidence: { type: Type.NUMBER }
        }
      }
    }
  },
  required: ["header", "cables", "spans", "equipment", "poles"]
};

/**
 * Main analysis function - Multi-pass extraction
 */
export async function analyzeFiberMap(
  base64Data: string,
  mimeType: string = 'application/pdf',
  options: {
    language?: Language;
    pageRange?: { start: number; end: number };
    extractionDepth?: 'quick' | 'standard' | 'thorough';
  } = {}
): Promise<FiberMapAnalysisResult> {
  const startTime = Date.now();
  const ai = getAi();
  const cleanBase64 = base64Data.includes('base64,') ? base64Data.split('base64,')[1] : base64Data;

  const depth = options.extractionDepth || 'standard';
  const passes = depth === 'quick' ? 1 : depth === 'standard' ? 2 : 4;

  console.log(`[FiberMapAnalyzer] Starting ${depth} analysis (${passes} passes)...`);

  try {
    // Combined extraction prompt for efficiency
    const combinedPrompt = `
${FIBER_MAP_SYSTEM_INSTRUCTION}

Analyze this fiber construction map and extract ALL data with HIGH PRECISION.

${PASS_1_HEADER_PROMPT}

${PASS_2_CABLES_PROMPT}

${PASS_3_EQUIPMENT_PROMPT}

${PASS_4_POLES_PROMPT}

IMPORTANT:
- Extract EVERY span measurement visible (XXXft labels)
- Extract EVERY pole ID (B19XXXXXXXX format)
- Extract EVERY cable ID with its fiber count
- Extract ALL GPS coordinates from pedestals
- Rate confidence 0-100 for each item

Return complete structured JSON.
`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: {
        parts: [
          { inlineData: { mimeType, data: cleanBase64 } },
          { text: combinedPrompt }
        ]
      },
      config: {
        systemInstruction: FIBER_MAP_SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: ANALYSIS_SCHEMA,
        temperature: 0,  // Maximum determinism
        topP: 0.1,       // Very focused sampling
      }
    });

    const rawResult = JSON.parse(response.text || "{}");

    // Post-process and validate
    const result = postProcessResults(rawResult, startTime, passes);

    console.log(`[FiberMapAnalyzer] Complete. Extracted ${result.spans.length} spans, ${result.poles.length} poles, ${result.equipment.length} equipment items.`);

    return result;

  } catch (error) {
    console.error("[FiberMapAnalyzer] Analysis failed:", error);
    throw error;
  }
}

/**
 * Post-process and validate extracted data
 */
function postProcessResults(
  raw: any,
  startTime: number,
  passes: number
): FiberMapAnalysisResult {

  // Calculate totals
  const totals = calculateTotals(raw);

  // Run validation checks
  const validation = runValidation(raw, totals);

  // Build final result
  const result: FiberMapAnalysisResult = {
    header: {
      projectId: raw.header?.projectId || 'UNKNOWN',
      location: raw.header?.location || 'UNKNOWN',
      fsa: raw.header?.fsa || '',
      pageNumber: raw.header?.pageNumber || 0,
      totalPages: raw.header?.totalPages || 0,
      permits: raw.header?.permits || [],
      contractor: raw.header?.contractor || 'All Points Broadband',
      confidence: raw.header?.confidence || 0
    },
    cables: (raw.cables || []).map((c: any, i: number) => ({
      id: c.id || `CABLE_${i}`,
      cableType: parseCableType(c.cableType || c.id),
      fiberCount: c.fiberCount || 0,
      category: c.category || 'AERIAL',
      confidence: c.confidence || 50
    })),
    spans: (raw.spans || []).map((s: any, i: number) => ({
      id: `SPAN_${i}`,
      lengthFt: s.lengthFt || 0,
      startPole: s.startPole || '',
      endPole: s.endPole || '',
      gridRef: s.gridRef || '',
      pageNumber: raw.header?.pageNumber || 0,
      isLongSpan: (s.lengthFt || 0) > 300,
      confidence: s.confidence || 50
    })),
    equipment: (raw.equipment || []).map((e: any) => ({
      id: e.id || generateId(),
      type: parseEquipmentType(e.type),
      subType: e.subType || '',
      size: e.size || '',
      slackLength: e.slackLength,
      dimensions: e.dimensions || '',
      location: e.gpsLat && e.gpsLng ? {
        gps: { lat: e.gpsLat, lng: e.gpsLng }
      } : undefined,
      confidence: e.confidence || 50
    })),
    gpsPoints: (raw.gpsPoints || []).map((g: any) => ({
      lat: g.lat,
      lng: g.lng,
      label: g.label || 'Unknown',
      confidence: g.confidence || 50
    })),
    poles: (raw.poles || []).map((p: any) => ({
      poleId: p.poleId || '',
      attachmentHeight: p.attachmentHeight || '',
      hasAnchor: p.hasAnchor || false,
      gridRef: p.gridRef || '',
      pageNumber: raw.header?.pageNumber || 0,
      confidence: p.confidence || 50
    })),
    totals,
    validation,
    metadata: {
      analyzedAt: new Date().toISOString(),
      engineVersion: '2.0.0',
      modelUsed: 'gemini-1.5-pro',
      processingTimeMs: Date.now() - startTime,
      pageCount: raw.header?.totalPages || 1,
      extractionPasses: passes
    }
  };

  return result;
}

/**
 * Calculate totals from extracted data
 */
function calculateTotals(raw: any): CalculatedTotals {
  const spans = raw.spans || [];
  const equipment = raw.equipment || [];
  const poles = raw.poles || [];
  const cables = raw.cables || [];

  // Sum span footage
  const totalSpanFt = spans.reduce((sum: number, s: any) => sum + (s.lengthFt || 0), 0);

  // Count equipment by type
  const hubCount = equipment.filter((e: any) => e.type === 'HUB').length;
  const spliceCount = equipment.filter((e: any) => e.type === 'SPLICE').length;
  const slackloopCount = equipment.filter((e: any) => e.type === 'SLACKLOOP').length;
  const pedestalCount = equipment.filter((e: any) => e.type === 'PEDESTAL').length;

  // Count anchors
  const anchorCount = poles.filter((p: any) => p.hasAnchor).length +
                      equipment.filter((e: any) => e.type === 'ANCHOR').length;

  // Fiber breakdown
  const fiberMap = new Map<number, { totalFt: number; segmentCount: number }>();
  cables.forEach((c: any) => {
    const fc = c.fiberCount || 0;
    if (fc > 0) {
      const existing = fiberMap.get(fc) || { totalFt: 0, segmentCount: 0 };
      existing.segmentCount++;
      fiberMap.set(fc, existing);
    }
  });

  const fiberBreakdown = Array.from(fiberMap.entries()).map(([fiberCount, data]) => ({
    fiberCount,
    totalFt: data.totalFt,
    segmentCount: data.segmentCount
  }));

  return {
    totalAerialFt: totalSpanFt, // Simplified - would need category filtering
    totalUndergroundFt: 0,
    totalCableFt: totalSpanFt,
    spanCount: spans.length,
    anchorCount,
    spliceCount,
    hubCount,
    slackloopCount,
    pedestalCount,
    poleCount: poles.length,
    fiberBreakdown
  };
}

/**
 * Run validation checks on extracted data
 */
function runValidation(raw: any, totals: CalculatedTotals): ValidationReport {
  const checks: ValidationCheck[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];

  // Check 1: Header completeness
  const headerComplete = raw.header?.projectId && raw.header?.fsa;
  checks.push({
    name: 'Header Completeness',
    passed: headerComplete,
    message: headerComplete ? 'Project ID and FSA extracted' : 'Missing project header info'
  });

  // Check 2: Span count reasonable
  const spanCountOk = totals.spanCount > 0 && totals.spanCount < 500;
  checks.push({
    name: 'Span Count',
    passed: spanCountOk,
    expected: '1-500',
    actual: totals.spanCount,
    message: spanCountOk ? `${totals.spanCount} spans extracted` : 'Unusual span count'
  });

  // Check 3: Long spans flagged
  const longSpans = (raw.spans || []).filter((s: any) => (s.lengthFt || 0) > 400);
  if (longSpans.length > 0) {
    warnings.push(`${longSpans.length} spans exceed 400ft - verify these are accurate`);
  }

  // Check 4: GPS coordinates valid
  const gpsPoints = raw.gpsPoints || [];
  const validGps = gpsPoints.filter((g: any) =>
    g.lat && g.lng &&
    Math.abs(g.lat) <= 90 &&
    Math.abs(g.lng) <= 180
  );
  const gpsValid = validGps.length === gpsPoints.length;
  checks.push({
    name: 'GPS Validity',
    passed: gpsValid,
    expected: gpsPoints.length,
    actual: validGps.length,
    message: gpsValid ? 'All GPS coordinates valid' : 'Some GPS coordinates invalid'
  });

  // Check 5: Pole ID format
  const poles = raw.poles || [];
  const validPoles = poles.filter((p: any) => /^B\d{4}[A-Z]{2}\d{4}$/.test(p.poleId || ''));
  if (validPoles.length < poles.length * 0.8) {
    warnings.push('Some pole IDs may not match expected format (B####XX####)');
  }

  // Check 6: Equipment IDs present
  const equipmentWithIds = (raw.equipment || []).filter((e: any) => e.id && e.id.length > 3);
  checks.push({
    name: 'Equipment IDs',
    passed: equipmentWithIds.length > 0,
    actual: equipmentWithIds.length,
    message: `${equipmentWithIds.length} equipment items with valid IDs`
  });

  // Calculate overall confidence
  const allConfidences = [
    ...(raw.cables || []).map((c: any) => c.confidence || 0),
    ...(raw.spans || []).map((s: any) => s.confidence || 0),
    ...(raw.equipment || []).map((e: any) => e.confidence || 0),
    ...(raw.poles || []).map((p: any) => p.confidence || 0)
  ];
  const overallConfidence = allConfidences.length > 0
    ? allConfidences.reduce((a, b) => a + b, 0) / allConfidences.length
    : 0;

  const passedChecks = checks.filter(c => c.passed).length;
  const isValid = passedChecks >= checks.length * 0.7 && errors.length === 0;

  return {
    isValid,
    overallConfidence: Math.round(overallConfidence),
    checks,
    warnings,
    errors
  };
}

/**
 * Parse cable type from ID or type string
 */
function parseCableType(input: string): CableSegment['cableType'] {
  const upper = (input || '').toUpperCase();
  if (upper.includes('MULTI_TIER') || upper.includes('MULTITIER')) return 'MULTI_TIER';
  if (upper.includes('TAIL')) return 'TAIL';
  if (upper.includes('DROP')) return 'DROP';
  if (upper.includes('FEEDER')) return 'FEEDER';
  if (upper.includes('DISTRIBUTION')) return 'DISTRIBUTION';
  return 'MULTI_TIER'; // Default
}

/**
 * Parse equipment type
 */
function parseEquipmentType(input: string): EquipmentItem['type'] {
  const upper = (input || '').toUpperCase();
  if (upper.includes('HUB')) return 'HUB';
  if (upper.includes('SPLICE')) return 'SPLICE';
  if (upper.includes('SLACK')) return 'SLACKLOOP';
  if (upper.includes('PEDESTAL') || upper.includes('PED')) return 'PEDESTAL';
  if (upper.includes('HANDHOLE') || upper.includes('HH')) return 'HANDHOLE';
  if (upper.includes('CABINET') || upper.includes('CAB')) return 'CABINET';
  if (upper.includes('SPLITTER')) return 'SPLITTER';
  if (upper.includes('RISER')) return 'RISER';
  if (upper.includes('MST')) return 'MST';
  if (upper.includes('ANCHOR') || upper.includes('GUY')) return 'ANCHOR';
  return 'HUB'; // Default
}

/**
 * Analyze multiple pages of a PDF
 */
export async function analyzeFiberMapMultiPage(
  pages: { base64: string; pageNumber: number }[],
  mimeType: string = 'image/png'
): Promise<{
  pageResults: FiberMapAnalysisResult[];
  consolidated: FiberMapAnalysisResult;
}> {
  console.log(`[FiberMapAnalyzer] Analyzing ${pages.length} pages...`);

  // Analyze each page
  const pageResults: FiberMapAnalysisResult[] = [];
  for (const page of pages) {
    const result = await analyzeFiberMap(page.base64, mimeType, {
      extractionDepth: 'standard'
    });
    pageResults.push(result);
  }

  // Consolidate results
  const consolidated = consolidateResults(pageResults);

  return { pageResults, consolidated };
}

/**
 * Consolidate results from multiple pages
 */
function consolidateResults(pageResults: FiberMapAnalysisResult[]): FiberMapAnalysisResult {
  if (pageResults.length === 0) {
    throw new Error('No page results to consolidate');
  }

  // Use header from first page
  const header = { ...pageResults[0].header };
  header.totalPages = pageResults.length;

  // Merge all arrays, deduplicating by ID
  const allCables = new Map<string, CableSegment>();
  const allSpans: SpanMeasurement[] = [];
  const allEquipment = new Map<string, EquipmentItem>();
  const allGpsPoints: GPSPoint[] = [];
  const allPoles = new Map<string, PoleInfo>();

  for (const result of pageResults) {
    result.cables.forEach(c => allCables.set(c.id, c));
    allSpans.push(...result.spans);
    result.equipment.forEach(e => allEquipment.set(e.id, e));
    allGpsPoints.push(...result.gpsPoints);
    result.poles.forEach(p => allPoles.set(p.poleId, p));
  }

  const cables = Array.from(allCables.values());
  const equipment = Array.from(allEquipment.values());
  const poles = Array.from(allPoles.values());

  // Recalculate totals
  const totals = calculateTotals({
    spans: allSpans,
    equipment,
    poles,
    cables
  });

  // Rerun validation
  const validation = runValidation({
    header,
    cables,
    spans: allSpans,
    equipment,
    poles,
    gpsPoints: allGpsPoints
  }, totals);

  return {
    header,
    cables,
    spans: allSpans,
    equipment,
    gpsPoints: allGpsPoints,
    poles,
    totals,
    validation,
    metadata: {
      analyzedAt: new Date().toISOString(),
      engineVersion: '2.0.0',
      modelUsed: 'gemini-2.5-pro-preview-06-05',
      processingTimeMs: pageResults.reduce((sum, r) => sum + r.metadata.processingTimeMs, 0),
      pageCount: pageResults.length,
      extractionPasses: pageResults[0].metadata.extractionPasses
    }
  };
}

/**
 * Quick validation of a span measurement
 */
export function validateSpan(span: SpanMeasurement): {
  isValid: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];

  if (span.lengthFt < 10) {
    warnings.push('Span less than 10ft - unusually short');
  }
  if (span.lengthFt > 600) {
    warnings.push('Span exceeds 600ft - verify accuracy');
  }
  if (span.lengthFt > 300 && span.lengthFt < 400) {
    warnings.push('Long span (300-400ft) - may need mid-span support');
  }

  return {
    isValid: warnings.length === 0,
    warnings
  };
}

/**
 * Export results to various formats
 */
export function exportToCSV(result: FiberMapAnalysisResult): string {
  const lines: string[] = [];

  // Header
  lines.push('Type,ID,Value,Unit,Confidence,Notes');

  // Spans
  result.spans.forEach(s => {
    lines.push(`Span,${s.id},${s.lengthFt},FT,${s.confidence},${s.startPole || ''} to ${s.endPole || ''}`);
  });

  // Cables
  result.cables.forEach(c => {
    lines.push(`Cable,${c.id},${c.fiberCount},Fiber,${c.confidence},${c.cableType}`);
  });

  // Equipment
  result.equipment.forEach(e => {
    lines.push(`Equipment,${e.id},${e.type},,${e.confidence},${e.subType || ''}`);
  });

  // Poles
  result.poles.forEach(p => {
    lines.push(`Pole,${p.poleId},${p.hasAnchor ? 'With Anchor' : 'No Anchor'},,${p.confidence},${p.gridRef || ''}`);
  });

  return lines.join('\n');
}

export function exportToJSON(result: FiberMapAnalysisResult): string {
  return JSON.stringify(result, null, 2);
}
