/**
 * NextGen Fiber AI Agent - Production Report Service
 * Frontend service for production report processing
 */

import { ProductionReport, ProductionValidationResult } from '../types';

const API_BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8000/api/v1';

export interface ExtractResponse {
    success: boolean;
    report_id?: string;
    report?: ProductionReport;
    validation?: ProductionValidationResult;
    message?: string;
}

/**
 * Extract and validate production report from PDF
 */
export async function extractProductionReport(
    base64Data: string,
    filename: string
): Promise<ExtractResponse> {
    const response = await fetch(`${API_BASE}/production/extract`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            base64_data: base64Data,
            filename: filename,
            mime_type: 'application/pdf'
        })
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Extraction failed: ${error}`);
    }

    return response.json();
}

/**
 * Upload and process production report PDF file
 */
export async function uploadProductionReport(file: File): Promise<ExtractResponse> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE}/production/upload`, {
        method: 'POST',
        body: formData
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Upload failed: ${error}`);
    }

    return response.json();
}

/**
 * Re-validate an existing production report
 */
export async function validateProductionReport(
    report: ProductionReport
): Promise<ProductionValidationResult> {
    const response = await fetch(`${API_BASE}/production/validate`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(report)
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Validation failed: ${error}`);
    }

    const result = await response.json();
    return result.validation;
}

/**
 * Check production service health
 */
export async function checkProductionServiceHealth(): Promise<boolean> {
    try {
        const response = await fetch(`${API_BASE}/production/health`);
        return response.ok;
    } catch {
        return false;
    }
}
