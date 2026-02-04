/**
 * NextGen Fiber AI Agent - SmartSheets Service
 * Frontend service for SmartSheets integration
 */

import { ProductionReport } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export interface SheetInfo {
    id: number;
    name: string;
    permalink?: string;
    created_at?: string;
    modified_at?: string;
    total_row_count: number;
}

export interface ColumnInfo {
    id: number;
    title: string;
    type: string;
    index: number;
    primary: boolean;
}

export interface ConnectionStatus {
    connected: boolean;
    user_id?: number;
    email?: string;
    name?: string;
    error?: string;
}

export interface SyncResult {
    success: boolean;
    operation?: string;
    row_id?: number;
    run_id?: string;
    sheet_id?: number;
    error?: string;
}

export interface SyncStatus {
    synced: boolean;
    row_id?: number;
    row_number?: number;
    last_values?: Record<string, any>;
}

export interface ColumnMapping {
    header_mapping: Record<string, string>;
    production_mapping: Record<string, string>;
}

/**
 * Test SmartSheets API connection
 */
export async function testConnection(): Promise<ConnectionStatus> {
    const response = await fetch(`${API_BASE}/smartsheets/test-connection`);

    if (!response.ok) {
        return { connected: false, error: 'Failed to connect' };
    }

    return response.json();
}

/**
 * List all accessible sheets
 */
export async function listSheets(): Promise<SheetInfo[]> {
    const response = await fetch(`${API_BASE}/smartsheets/sheets`);

    if (!response.ok) {
        throw new Error('Failed to list sheets');
    }

    return response.json();
}

/**
 * Get sheet details with columns
 */
export async function getSheet(sheetId: number): Promise<any> {
    const response = await fetch(`${API_BASE}/smartsheets/sheets/${sheetId}`);

    if (!response.ok) {
        throw new Error('Failed to get sheet');
    }

    return response.json();
}

/**
 * Get column definitions for a sheet
 */
export async function getColumns(sheetId: number): Promise<ColumnInfo[]> {
    const response = await fetch(`${API_BASE}/smartsheets/sheets/${sheetId}/columns`);

    if (!response.ok) {
        throw new Error('Failed to get columns');
    }

    return response.json();
}

/**
 * Sync a production report to SmartSheets
 */
export async function syncReport(
    sheetId: number,
    report: ProductionReport,
    updateExisting: boolean = true
): Promise<SyncResult> {
    const response = await fetch(`${API_BASE}/smartsheets/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            sheet_id: sheetId,
            report: report,
            update_existing: updateExisting
        })
    });

    if (!response.ok) {
        const error = await response.text();
        return { success: false, error };
    }

    return response.json();
}

/**
 * Batch sync multiple reports
 */
export async function batchSyncReports(
    sheetId: number,
    reports: ProductionReport[]
): Promise<{
    total: number;
    success_count: number;
    error_count: number;
    results: SyncResult[];
}> {
    const response = await fetch(`${API_BASE}/smartsheets/sync/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            sheet_id: sheetId,
            reports: reports
        })
    });

    if (!response.ok) {
        throw new Error('Batch sync failed');
    }

    return response.json();
}

/**
 * Check sync status for a run_id
 */
export async function getSyncStatus(sheetId: number, runId: string): Promise<SyncStatus> {
    const response = await fetch(`${API_BASE}/smartsheets/sync/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            sheet_id: sheetId,
            run_id: runId
        })
    });

    if (!response.ok) {
        throw new Error('Failed to get sync status');
    }

    return response.json();
}

/**
 * Get default column mapping
 */
export async function getDefaultMapping(): Promise<ColumnMapping> {
    const response = await fetch(`${API_BASE}/smartsheets/mapping/default`);

    if (!response.ok) {
        throw new Error('Failed to get mapping');
    }

    return response.json();
}

/**
 * Preview how a report would be mapped
 */
export async function previewMapping(
    report: ProductionReport,
    customMapping?: Partial<ColumnMapping>
): Promise<{ preview: Record<string, any>; field_count: number }> {
    const response = await fetch(`${API_BASE}/smartsheets/mapping/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            report: report,
            mapping: customMapping
        })
    });

    if (!response.ok) {
        throw new Error('Failed to preview mapping');
    }

    return response.json();
}

/**
 * Check SmartSheets service health
 */
export async function checkHealth(): Promise<{
    status: string;
    service: string;
    configured: boolean;
    connected: boolean;
}> {
    try {
        const response = await fetch(`${API_BASE}/smartsheets/health`);
        return response.json();
    } catch {
        return {
            status: 'offline',
            service: 'smartsheets',
            configured: false,
            connected: false
        };
    }
}
