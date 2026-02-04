
export enum Language {
    PT = 'PT',
    EN = 'EN',
    ES = 'ES'
}

export enum AuditStatus {
    PENDING = 'PENDING',
    COMPLIANT = 'COMPLIANT',
    DIVERGENT = 'DIVERGENT',
    CRITICAL = 'CRITICAL'
}

export interface User {
    id: string;
    email: string;
    role: 'ADMIN' | 'LINEMAN';
    name: string;
    companyName: string;
    companyLogo?: string;
    companyAddress?: string;
    companyPhone?: string;
    companyWebsite?: string;
    companyTaxId?: string;
    supervisorName?: string;
    profilePic?: string;
}

export interface Notification {
    id: string;
    title: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
    timestamp: string;
    read: boolean;
}

export interface MapAuditReport {
    id: string;
    fileName: string;
    date: string;
    result: MapAnalysisResult;
    certifiedBy: string;
}

export interface FieldReport {
    id: string;
    timestamp: string;
    author: string;
    rawTranscript: string;
    summaryPT: string;
    summaryEN: string;
    category: 'DAILY_LOG' | 'INCIDENT' | 'COMPLETION';
    tags: string[];
}

export type Report = MapAuditReport | FieldReport;

export interface AuditResult {
    id: string;
    timestamp: string;
    imageUrl?: string;
    status: AuditStatus;
    complianceScore: number;
    detectedItems: string[];
    issues: string[];
    aiSummary: string;
    auditedBy: string;
    companyName: string;
}

export interface MapAnalysisResult {
    totalCableLength: number;
    aerialFootage: number;
    undergroundFootage: number;
    strandFootage?: number;
    cableType: string;
    spanCount: number;
    anchorCount?: number;
    mstCount?: number;
    difficultyRating?: string;
    projectStartGps?: { lat: number; lng: number; label: string };
    
    // Topology Logic: High Precision Visualization
    segments: Array<{
        id: string;
        length: number;
        type: 'AERIAL' | 'UNDERGROUND';
        fiberType?: string; // 144F, 288F, etc
        colorCode?: string; // Hex color from legend
        coords?: [number, number][]; // Lat/Lng points extracted
        startNode?: string;
        endNode?: string;
    }>;
    
    equipmentCounts: Array<{ name: string; quantity: number }>;
    financials: {
        estimatedLaborCost: number;
        potentialSavings: number;
    };
    materialList: Array<{
        item: string;
        quantity: number;
        unit: string;
        category: string;
    }>;
    detectedAnomalies: string[];
}

export interface MarketAnalysis {
    zoneName: string;
    homesPassed: number;
    estimatedTakeRate: number;
    projectedMonthlyRevenue: number;
    estimatedBuildCost: number;
    roiMonths: number;
    difficultyScore: number;
    verdict: 'GO' | 'NO-GO' | 'HOLD';
    strategicReasoning: string;
}

export interface AuditFile {
    id: string;
    name: string;
    blobUrl: string;
    base64: string;
    result: MapAnalysisResult | null;
    status: 'idle' | 'analyzing' | 'completed' | 'error';
}

export interface Project {
    id: string;
    routeId: string;
    name: string;
    type: string;
    crew: string;
    priority: string;
    deadline: string;
    description: string;
    analysisResult?: MapAnalysisResult | null;
}

export enum ViewState {
    DASHBOARD = 'DASHBOARD',
    MAPS = 'MAPS',
    AUDIT = 'AUDIT',
    BOQ = 'BOQ',
    ADMIN = 'ADMIN',
    LINEMAN = 'LINEMAN',
    AI_ASSISTANT = 'AI_ASSISTANT',
    REPORTS = 'REPORTS',
    AGENCY = 'AGENCY',
    META_GLASS = 'META_GLASS',
    PRODUCTION = 'PRODUCTION',
    FINANCE_HUB = 'FINANCE_HUB',
    MAP_ANALYZER = 'MAP_ANALYZER',
    // Lineman workflow views
    MY_JOBS = 'MY_JOBS',               // Lineman's assigned jobs list
    JOB_DETAILS = 'JOB_DETAILS',       // Single job details with map & notes
    SUBMIT_WORK = 'SUBMIT_WORK',       // Production sheet for a job
    MY_SUBMISSIONS = 'MY_SUBMISSIONS', // Lineman's history
    // Owner workflow views
    INBOX = 'INBOX',                   // Owner's command center
    BY_CLIENT = 'BY_CLIENT',           // View by client
    BY_PROJECT = 'BY_PROJECT'          // View by project
}

export interface Invoice {
    id: string;
    crewName: string;
    totalFootage: number;
    totalAmount: number;
    status: 'APPROVED' | 'PAID' | 'PENDING_QC' | 'REJECTED';
    qcStatus: 'PASSED' | 'FAILED' | 'NOT_STARTED';
    date: string;
}

export interface UnitRates {
    fiber: number;
    anchor: number;
    strand?: number;
    overlash?: number;
    snowshoe?: number;
    composite?: number;
    riser?: number;
}

export interface Transaction {
    id: string;
    date: string;
    amount: number;
    fee: number;
    netAmount: number;
    status: 'COMPLETED' | 'PENDING' | 'FAILED';
    type: 'PAYOUT' | 'INCOME';
    description: string;
}

// ============================================
// PRODUCTION REPORT TYPES (Produção Diária)
// ============================================

export type QCStatus = 'PENDING' | 'PASSED' | 'FAILED' | 'NEEDS_REVIEW';

export interface PoleEntry {
    span_feet: number;
    anchor: boolean;
    pole_id_raw: string;
    pole_ids: string[];
    is_splice_point: boolean;
    coil: boolean;
    snowshoe: boolean;
    notes?: string;
    cumulative_feet: number;
}

export interface ProductionReportHeader {
    lineman_name: string;
    start_date: string;
    end_date: string;
    city: string;
    project_name: string;
    fiber_count: number;
    run_id: string;
    declared_total_feet: number;
    service_type: string;
    customer?: string;
    olt_cabinet?: string;
    feeder_id?: string;
}

export interface ProductionReport {
    id: string;
    source_file: string;
    header: ProductionReportHeader;
    entries: PoleEntry[];
    calculated_total_feet: number;
    total_anchors: number;
    total_coils: number;
    total_snowshoes: number;
    total_splice_points: number;
    extraction_confidence: number;
    extraction_timestamp: string;
    extracted_by: string;
}

export interface ValidationError {
    code: string;
    message: string;
    field?: string;
    expected?: string;
    actual?: string;
    entry_index?: number;
}

export interface ValidationWarning {
    code: string;
    message: string;
    field?: string;
    suggestion?: string;
    entry_index?: number;
}

export interface ProductionValidationResult {
    report_id: string;
    lineman: string;
    project: string;
    run_id: string;
    date: string;
    qc_status: QCStatus;
    is_valid: boolean;
    metrics: {
        declared_total_ft: number;
        calculated_total_ft: number;
        discrepancy_ft: number;
        discrepancy_pct: number;
        entry_count: number;
        anchor_count: number;
        coil_count: number;
        snowshoe_count: number;
        splice_point_count: number;
    };
    errors: ValidationError[];
    warnings: ValidationWarning[];
    recommendations: string[];
}

// ============================================
// PRODUCTION REPORT TYPES (Produção Diária)
// ============================================

export type QCStatus = 'PENDING' | 'PASSED' | 'FAILED' | 'NEEDS_REVIEW';

export interface PoleEntry {
    span_feet: number;
    anchor: boolean;
    pole_id_raw: string;
    pole_ids: string[];
    is_splice_point: boolean;
    coil: boolean;
    snowshoe: boolean;
    notes?: string;
    cumulative_feet: number;
}

export interface ProductionReportHeader {
    lineman_name: string;
    start_date: string;
    end_date: string;
    city: string;
    project_name: string;
    fiber_count: number;
    run_id: string;
    declared_total_feet: number;
    service_type: string;
    customer?: string;
    olt_cabinet?: string;
    feeder_id?: string;
}

export interface ProductionReport {
    id: string;
    source_file: string;
    header: ProductionReportHeader;
    entries: PoleEntry[];
    calculated_total_feet: number;
    total_anchors: number;
    total_coils: number;
    total_snowshoes: number;
    total_splice_points: number;
    extraction_confidence: number;
    extraction_timestamp: string;
    extracted_by: string;
}

export interface ValidationError {
    code: string;
    message: string;
    field?: string;
    expected?: string;
    actual?: string;
    entry_index?: number;
}

export interface ValidationWarning {
    code: string;
    message: string;
    field?: string;
    suggestion?: string;
    entry_index?: number;
}

export interface ProductionValidationResult {
    report_id: string;
    lineman: string;
    project: string;
    run_id: string;
    date: string;
    qc_status: QCStatus;
    is_valid: boolean;
    metrics: {
        declared_total_ft: number;
        calculated_total_ft: number;
        discrepancy_ft: number;
        discrepancy_pct: number;
        entry_count: number;
        anchor_count: number;
        coil_count: number;
        snowshoe_count: number;
        splice_point_count: number;
    };
    errors: ValidationError[];
    warnings: ValidationWarning[];
    recommendations: string[];
}