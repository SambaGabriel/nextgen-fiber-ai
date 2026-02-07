/**
 * Excel Parser for Rate Cards
 * Parses Excel files and validates rate card data
 */

import * as XLSX from 'xlsx';

export interface ParsedRateItem {
  code: string;
  description: string;
  unit: 'FT' | 'EA' | 'HR' | 'DAY';
  nextgen_rate: number;
  lineman_rate: number;
  truck_investor_rate: number;
}

export interface ParsedSheet {
  sheetName: string;
  profileName: string;
  items: ParsedRateItem[];
  errors: ParseError[];
  warnings: ParseWarning[];
}

export interface ParseError {
  row: number;
  column: string;
  message: string;
}

export interface ParseWarning {
  row: number;
  column: string;
  message: string;
}

export interface ParseResult {
  fileName: string;
  sheets: ParsedSheet[];
  summary: {
    totalSheets: number;
    totalItems: number;
    totalErrors: number;
    totalWarnings: number;
  };
}

// Column name mappings (flexible)
const CODE_COLUMNS = ['code', 'item code', 'item number', 'rate code', 'item_code', 'item_number'];
const DESC_COLUMNS = ['description', 'item description', 'desc', 'item_description'];
const UNIT_COLUMNS = ['unit', 'uom', 'unit of measure'];
const NEXTGEN_COLUMNS = ['nextgen rate', 'nextgen', 'company rate', 'revenue rate', 'nextgen_rate'];
const LINEMAN_COLUMNS = ['lineman rate', 'lineman', 'linemen rate', 'crew rate', 'lineman_rate', 'linemen_rate'];
const INVESTOR_COLUMNS = ['truck investor rate', 'investor rate', 'truck rate', 'truck_investor_rate', 'investor_rate'];
const PROFILE_COLUMNS = ['profile', 'profile name', 'profile_name'];

function normalizeHeader(header: string): string {
  return header.toLowerCase().trim().replace(/[^a-z0-9 _]/g, '');
}

function findColumn(headers: string[], possibleNames: string[]): number {
  for (let i = 0; i < headers.length; i++) {
    const normalized = normalizeHeader(headers[i] || '');
    if (possibleNames.includes(normalized)) {
      return i;
    }
  }
  return -1;
}

function parseUnit(value: string): 'FT' | 'EA' | 'HR' | 'DAY' {
  const normalized = (value || '').toUpperCase().trim();

  if (['FT', 'FOOT', 'FEET', 'LF', 'LINEAR FOOT', 'PER FOOT'].includes(normalized)) return 'FT';
  if (['EA', 'EACH', 'UNIT', 'PER EACH'].includes(normalized)) return 'EA';
  if (['HR', 'HOUR', 'HOURLY', 'PER HOUR'].includes(normalized)) return 'HR';
  if (['DAY', 'DAILY', 'PER DAY'].includes(normalized)) return 'DAY';

  return 'FT'; // Default
}

function parseRate(value: any): number {
  if (typeof value === 'number') return value;
  if (value === null || value === undefined) return 0;

  const str = String(value).trim();

  // Handle N/A, null, empty
  if (!str || str === 'N/A' || str === 'n/a' || str === '-') return 0;

  // Remove $ and commas
  const cleaned = str.replace(/[$,]/g, '');

  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

export function parseExcelFile(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        const sheets: ParsedSheet[] = [];

        for (const sheetName of workbook.SheetNames) {
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

          if (jsonData.length < 2) {
            continue; // Skip empty sheets
          }

          const parsedSheet = parseSheet(sheetName, jsonData);
          if (parsedSheet.items.length > 0 || parsedSheet.errors.length > 0) {
            sheets.push(parsedSheet);
          }
        }

        const result: ParseResult = {
          fileName: file.name,
          sheets,
          summary: {
            totalSheets: sheets.length,
            totalItems: sheets.reduce((sum, s) => sum + s.items.length, 0),
            totalErrors: sheets.reduce((sum, s) => sum + s.errors.length, 0),
            totalWarnings: sheets.reduce((sum, s) => sum + s.warnings.length, 0),
          },
        };

        resolve(result);
      } catch (error) {
        reject(new Error('Failed to parse Excel file: ' + (error as Error).message));
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

function parseSheet(sheetName: string, data: any[][]): ParsedSheet {
  const headers = (data[0] || []).map(h => String(h || ''));
  const items: ParsedRateItem[] = [];
  const errors: ParseError[] = [];
  const warnings: ParseWarning[] = [];

  // Find column indices
  const codeIdx = findColumn(headers, CODE_COLUMNS);
  const descIdx = findColumn(headers, DESC_COLUMNS);
  const unitIdx = findColumn(headers, UNIT_COLUMNS);
  const nextgenIdx = findColumn(headers, NEXTGEN_COLUMNS);
  const linemanIdx = findColumn(headers, LINEMAN_COLUMNS);
  const investorIdx = findColumn(headers, INVESTOR_COLUMNS);

  // Validate required columns
  if (codeIdx === -1) {
    errors.push({ row: 1, column: 'Code', message: 'Required column "Code" not found' });
    return { sheetName, profileName: sheetName, items, errors, warnings };
  }

  if (nextgenIdx === -1 && linemanIdx === -1 && investorIdx === -1) {
    errors.push({ row: 1, column: 'Rate', message: 'At least one rate column required' });
    return { sheetName, profileName: sheetName, items, errors, warnings };
  }

  // Parse rows (skip header)
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0) continue;

    const rowNum = i + 1;
    const code = String(row[codeIdx] || '').trim().toUpperCase();

    // Skip empty rows
    if (!code) continue;

    const description = descIdx >= 0 ? String(row[descIdx] || '') : '';
    const unitRaw = unitIdx >= 0 ? String(row[unitIdx] || '') : 'FT';
    const unit = parseUnit(unitRaw);

    // Parse rates
    const nextgenRaw = nextgenIdx >= 0 ? row[nextgenIdx] : 0;
    const linemanRaw = linemanIdx >= 0 ? row[linemanIdx] : 0;
    const investorRaw = investorIdx >= 0 ? row[investorIdx] : 0;

    const nextgenRate = parseRate(nextgenRaw);
    const linemanRate = parseRate(linemanRaw);
    const investorRate = parseRate(investorRaw);

    // Warnings for N/A values
    if (linemanIdx >= 0 && (linemanRaw === 'N/A' || linemanRaw === 'n/a')) {
      warnings.push({ row: rowNum, column: 'Lineman Rate', message: 'Value "N/A" converted to 0' });
    }
    if (investorIdx >= 0 && (investorRaw === 'N/A' || investorRaw === 'n/a')) {
      warnings.push({ row: rowNum, column: 'Truck Investor Rate', message: 'Value "N/A" converted to 0' });
    }

    // Validate code format
    if (code.length < 2) {
      errors.push({ row: rowNum, column: 'Code', message: `Invalid code: "${code}"` });
      continue;
    }

    items.push({
      code,
      description,
      unit,
      nextgen_rate: nextgenRate,
      lineman_rate: linemanRate,
      truck_investor_rate: investorRate,
    });
  }

  return {
    sheetName,
    profileName: sheetName, // Use sheet name as profile name
    items,
    errors,
    warnings,
  };
}

// Helper to create downloadable template
export function createTemplateExcel(): Blob {
  const headers = [
    'Code',
    'Description',
    'Unit',
    'NextGen Rate',
    'Lineman Rate',
    'Truck Investor Rate',
  ];

  const sampleData = [
    headers,
    ['BSPD82C', 'Direct Aerial Place Fiber', 'FT', 0.70, 0.35, 0.05],
    ['BSPDSTRAND', 'Place Strand 6.6M', 'FT', 0.70, 0.30, 0.05],
    ['BSPDLASH', 'Overlash Fiber', 'FT', 0.90, 0.35, 0.05],
    ['BSPD85C', 'Fiber in Conduit', 'FT', 0.78, 0.36, 0.05],
    ['BSPDDBI', 'Directional Boring - initial', 'FT', 7.80, 0, 0],
  ];

  const ws = XLSX.utils.aoa_to_sheet(sampleData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Default');

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
