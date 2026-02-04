/**
 * NextGen Fiber - Billing System Type Definitions
 * Complete TypeScript interfaces for enterprise billing operations
 */

// ============================================
// ENUMS - Status and Categories
// ============================================

export enum ProductionLineStatus {
  NEW = 'NEW',
  PENDING_REVIEW = 'PENDING_REVIEW',
  REVIEWED = 'REVIEWED',
  NEEDS_INFO = 'NEEDS_INFO',
  READY_TO_INVOICE = 'READY_TO_INVOICE',
  INVOICED = 'INVOICED',
  ON_HOLD = 'ON_HOLD',
  REJECTED = 'REJECTED',
  PAID = 'PAID'
}

export enum InvoiceBatchStatus {
  DRAFT = 'DRAFT',
  READY = 'READY',
  SUBMITTED = 'SUBMITTED',
  APPROVED = 'APPROVED',
  PARTIALLY_APPROVED = 'PARTIALLY_APPROVED',
  REJECTED = 'REJECTED',
  DISPUTED = 'DISPUTED',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED'
}

export enum EvidenceType {
  PHOTO = 'PHOTO',
  DOCUMENT = 'DOCUMENT',
  GPS_LOG = 'GPS_LOG',
  SIGNATURE = 'SIGNATURE',
  VIDEO = 'VIDEO',
  OTHER = 'OTHER'
}

export enum ValidationSeverity {
  ERROR = 'ERROR',       // Blocks submission
  WARNING = 'WARNING',   // Requires acknowledgment
  INFO = 'INFO'          // Informational only
}

export enum UserRole {
  FIELD = 'FIELD',           // Can view, add evidence
  REVIEWER = 'REVIEWER',     // Can review, approve lines
  BILLING = 'BILLING',       // Can create batches, submit invoices
  ADMIN = 'ADMIN',           // Full access including rate cards
  VIEWER = 'VIEWER'          // Read-only access
}

export enum AuditEventType {
  LINE_CREATED = 'LINE_CREATED',
  LINE_UPDATED = 'LINE_UPDATED',
  LINE_STATUS_CHANGED = 'LINE_STATUS_CHANGED',
  LINE_QTY_ADJUSTED = 'LINE_QTY_ADJUSTED',
  LINE_RATE_OVERRIDDEN = 'LINE_RATE_OVERRIDDEN',
  BATCH_CREATED = 'BATCH_CREATED',
  BATCH_LINE_ADDED = 'BATCH_LINE_ADDED',
  BATCH_LINE_REMOVED = 'BATCH_LINE_REMOVED',
  BATCH_SUBMITTED = 'BATCH_SUBMITTED',
  BATCH_STATUS_CHANGED = 'BATCH_STATUS_CHANGED',
  RATE_CARD_CREATED = 'RATE_CARD_CREATED',
  RATE_CARD_VERSIONED = 'RATE_CARD_VERSIONED',
  EVIDENCE_ATTACHED = 'EVIDENCE_ATTACHED',
  EVIDENCE_REMOVED = 'EVIDENCE_REMOVED',
  PAYMENT_RECORDED = 'PAYMENT_RECORDED',
  DEDUCTION_APPLIED = 'DEDUCTION_APPLIED'
}

export enum DeductionCategory {
  RETAINAGE = 'RETAINAGE',
  EARLY_PAYMENT_FEE = 'EARLY_PAYMENT_FEE',
  QUALITY_PENALTY = 'QUALITY_PENALTY',
  MISSING_DOCUMENTATION = 'MISSING_DOCUMENTATION',
  RATE_ADJUSTMENT = 'RATE_ADJUSTMENT',
  OTHER = 'OTHER'
}

export enum RejectReason {
  MISSING_EVIDENCE = 'MISSING_EVIDENCE',
  EVIDENCE_MISMATCH = 'EVIDENCE_MISMATCH',
  QTY_DISPUTE = 'QTY_DISPUTE',
  RATE_DISPUTE = 'RATE_DISPUTE',
  DUPLICATE = 'DUPLICATE',
  NOT_AUTHORIZED = 'NOT_AUTHORIZED',
  DOCUMENTATION_ISSUE = 'DOCUMENTATION_ISSUE',
  OTHER = 'OTHER'
}

// ============================================
// CORE ENTITIES
// ============================================

/**
 * User with role-based access
 */
export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  permissions: Permission[];
  tenantId: string;  // Multi-tenant support
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface Permission {
  resource: string;  // 'production_lines', 'batches', 'rate_cards', etc.
  actions: ('read' | 'create' | 'update' | 'delete' | 'approve' | 'submit')[];
}

/**
 * Evidence/Attachment asset
 */
export interface EvidenceAsset {
  id: string;
  type: EvidenceType;
  filename: string;
  mimeType: string;
  fileSize: number;
  url: string;          // S3/GCS signed URL
  thumbnailUrl?: string;
  metadata: EvidenceMetadata;
  uploadedBy: string;
  uploadedAt: string;
  isVerified: boolean;
  verifiedBy?: string;
  verifiedAt?: string;
}

export interface EvidenceMetadata {
  // GPS data
  latitude?: number;
  longitude?: number;
  altitude?: number;
  accuracy?: number;

  // Capture info
  capturedAt?: string;
  deviceId?: string;
  deviceModel?: string;

  // Image specific
  width?: number;
  height?: number;
  orientation?: number;

  // Custom fields
  tags?: string[];
  notes?: string;
}

/**
 * Geolocation for production line
 */
export interface GeoLocation {
  latitude: number;
  longitude: number;
  address?: string;
  poleId?: string;
  accuracy?: number;
}

/**
 * Production Line - Main entity from Smartsheet/source
 */
export interface ProductionLine {
  id: string;
  externalId: string;        // Smartsheet row ID or source ID
  sourceSystem: string;      // 'smartsheet', 'native', etc.

  // Core production data
  jobId: string;
  description: string;
  quantity: number;
  unit: string;              // 'FT', 'EA', 'LF', etc.

  // Classification
  projectId: string;
  projectName: string;
  primeContractor: string;   // Customer/Prime
  crewId: string;
  crewName: string;

  // Work details
  workDate: string;
  completedDate?: string;
  location?: GeoLocation;
  workType: string;          // 'AERIAL', 'UNDERGROUND', etc.
  activityCode?: string;

  // Status tracking
  status: ProductionLineStatus;
  previousStatus?: ProductionLineStatus;
  statusChangedAt: string;
  statusChangedBy: string;

  // Evidence
  evidenceAssets: EvidenceAsset[];
  evidenceCount: number;
  hasRequiredEvidence: boolean;

  // Billing mapping (populated after review)
  billingLineItemId?: string;
  billingLineItemDescription?: string;
  appliedRateCardId?: string;
  appliedRateCardVersion?: number;
  appliedRate?: number;
  rateOverride?: RateOverride;

  // Calculated
  extendedAmount?: number;   // quantity * rate

  // Invoice reference (if invoiced)
  invoiceBatchId?: string;
  invoiceNumber?: string;
  invoicedAt?: string;

  // Validation
  validationResults: ValidationResult[];
  complianceScore: number;   // 0-100

  // Flags
  flags: LineFlag[];

  // Audit
  createdAt: string;
  updatedAt: string;
  syncedAt: string;          // Last sync from source
}

export interface LineFlag {
  type: 'ANOMALY' | 'DUPLICATE' | 'MISSING_EVIDENCE' | 'QTY_OUTLIER' | 'RATE_MISMATCH' | 'MANUAL_REVIEW';
  message: string;
  severity: ValidationSeverity;
  detectedAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

export interface RateOverride {
  originalRate: number;
  overrideRate: number;
  overrideBy: string;
  overrideAt: string;
  reason: string;
  reasonCode?: string;
}

/**
 * Validation Result for lines and batches
 */
export interface ValidationResult {
  id: string;
  ruleId: string;
  ruleName: string;
  passed: boolean;
  severity: ValidationSeverity;
  message: string;
  field?: string;
  expectedValue?: string;
  actualValue?: string;
  suggestion?: string;
  checkedAt: string;
}

/**
 * Compliance Score breakdown
 */
export interface ComplianceScore {
  overall: number;           // 0-100
  breakdown: {
    evidenceScore: number;   // Photos/docs present
    completenessScore: number; // Required fields filled
    consistencyScore: number;  // Data matches expectations
    timelinessScore: number;   // Submitted within SLA
  };
  passingThreshold: number;  // Usually 80
  isPassing: boolean;
}

// ============================================
// RATE CARDS
// ============================================

/**
 * Rate Card with versioning
 */
export interface RateCard {
  id: string;
  name: string;
  description?: string;

  // Scope
  primeContractor: string;   // Which customer
  projectId?: string;        // Optional project-specific
  region?: string;           // Optional region-specific

  // Version control
  currentVersion: number;
  versions: RateCardVersion[];

  // Dates
  effectiveFrom: string;
  effectiveTo?: string;      // null = no end date

  // Status
  isActive: boolean;

  // Audit
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface RateCardVersion {
  version: number;
  rates: RateCardItem[];
  effectiveFrom: string;
  effectiveTo?: string;
  createdBy: string;
  createdAt: string;
  changeNotes?: string;
}

export interface RateCardItem {
  id: string;
  lineItemCode: string;      // Billing line item code
  description: string;
  unit: string;
  rate: number;
  minQty?: number;
  maxQty?: number;
  conditions?: string;       // JSON conditions
}

/**
 * Billing Mapping Rule - Maps production to billing line items
 */
export interface BillingMappingRule {
  id: string;
  name: string;
  priority: number;          // Lower = higher priority

  // Matching criteria (all must match)
  criteria: {
    workType?: string | string[];
    activityCode?: string | string[];
    projectId?: string | string[];
    primeContractor?: string | string[];
    descriptionPattern?: string;  // Regex pattern
  };

  // Mapping result
  targetLineItemCode: string;
  targetDescription?: string;     // Override description
  rateCardId: string;

  // Modifiers
  qtyMultiplier?: number;         // e.g., 1.1 for 10% overhead

  // Dates
  effectiveFrom: string;
  effectiveTo?: string;

  // Status
  isActive: boolean;

  // Audit
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// INVOICE BATCHES
// ============================================

/**
 * Invoice Batch - Groups production lines for billing
 */
export interface InvoiceBatch {
  id: string;
  batchNumber: string;       // Human-readable number
  invoiceNumber?: string;    // Assigned on submit

  // Header info
  primeContractor: string;
  projectId: string;
  projectName: string;

  // Period
  periodStart: string;
  periodEnd: string;

  // Status
  status: InvoiceBatchStatus;
  statusHistory: StatusChange[];

  // Lines
  lineIds: string[];         // ProductionLine IDs included
  lineItems: InvoiceLineItemAggregate[];  // Aggregated for display

  // Totals (calculated)
  subtotal: number;
  deductions: Deduction[];
  deductionsTotal: number;
  retainagePercent?: number;
  retainageAmount?: number;
  taxRate?: number;
  taxAmount?: number;
  total: number;

  // Package
  packageReadiness: PackageReadiness;
  attachments: EvidenceAsset[];

  // Terms
  paymentTerms: string;      // 'NET30', 'NET45', etc.
  dueDate?: string;

  // Notes
  internalNotes?: string;
  customerNotes?: string;

  // Frozen data (captured on submit)
  frozenRateCards?: FrozenRateCard[];
  submittedAt?: string;
  submittedBy?: string;

  // Approval/Payment
  approvedAt?: string;
  approvedBy?: string;       // Customer contact
  approvedAmount?: number;   // May differ from total
  rejectionReason?: string;
  rejectionDetails?: string;

  paidAt?: string;
  paidAmount?: number;
  paymentReference?: string;

  // Audit
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface StatusChange {
  from: InvoiceBatchStatus;
  to: InvoiceBatchStatus;
  changedBy: string;
  changedAt: string;
  reason?: string;
  notes?: string;
}

/**
 * Aggregated line item for invoice display
 */
export interface InvoiceLineItemAggregate {
  lineItemCode: string;
  description: string;
  unit: string;

  // Quantities
  totalQty: number;
  qtyBreakdown: {
    lineId: string;
    jobId: string;
    qty: number;
    workDate: string;
  }[];

  // Rate (should be same for all lines in aggregate)
  rate: number;
  rateCardId: string;
  rateCardVersion: number;

  // Calculated
  extendedAmount: number;

  // Evidence summary
  evidenceCount: number;
  evidenceLinks: string[];   // URLs for package

  // Validation
  complianceScore: number;
  hasIssues: boolean;
}

export interface Deduction {
  id: string;
  category: DeductionCategory;
  description: string;
  amount: number;
  percentage?: number;       // If percentage-based
  appliedBy: string;
  appliedAt: string;
  reason: string;
  isDisputed?: boolean;
  disputeNotes?: string;
}

export interface FrozenRateCard {
  rateCardId: string;
  version: number;
  frozenAt: string;
  rates: RateCardItem[];
}

/**
 * Package readiness checklist
 */
export interface PackageReadiness {
  isReady: boolean;
  score: number;             // 0-100
  checklist: ChecklistItem[];
}

export interface ChecklistItem {
  id: string;
  requirement: string;
  category: 'DOCUMENTATION' | 'EVIDENCE' | 'APPROVAL' | 'CALCULATION' | 'FORMAT';
  isRequired: boolean;
  isPassed: boolean;
  message?: string;
  primeSpecific?: boolean;   // Is this a customer-specific requirement
}

// ============================================
// AUDIT & TRACKING
// ============================================

/**
 * Audit Event - Immutable record of all changes
 */
export interface AuditEvent {
  id: string;
  eventType: AuditEventType;

  // What changed
  entityType: 'ProductionLine' | 'InvoiceBatch' | 'RateCard' | 'User';
  entityId: string;

  // Change details
  previousValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  changedFields?: string[];

  // Context
  reason?: string;
  reasonCode?: string;

  // Who/When
  performedBy: string;
  performedAt: string;

  // Request context
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
}

/**
 * AR Aging Report entry
 */
export interface AgingEntry {
  invoiceBatchId: string;
  invoiceNumber: string;
  primeContractor: string;
  projectName: string;
  invoiceAmount: number;
  submittedAt: string;
  dueDate: string;
  status: InvoiceBatchStatus;
  daysOutstanding: number;
  agingBucket: '0-30' | '31-60' | '61-90' | '90+';
  lastActivity?: string;
  lastActivityAt?: string;
}

/**
 * Rejection tracking
 */
export interface RejectionRecord {
  id: string;
  invoiceBatchId: string;
  invoiceNumber: string;
  rejectedAt: string;
  rejectedBy: string;        // Customer contact
  reason: RejectReason;
  details: string;
  affectedLineItems?: string[];
  affectedAmount?: number;

  // Resolution
  isResolved: boolean;
  resolvedAt?: string;
  resolvedBy?: string;
  resolution?: string;
  resubmittedBatchId?: string;
}

// ============================================
// API CONTRACTS - Request/Response Types
// ============================================

// Pagination
export interface PaginatedRequest {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Production Lines
export interface ProductionLineFilters {
  projectId?: string;
  primeContractor?: string;
  crewId?: string;
  status?: ProductionLineStatus | ProductionLineStatus[];
  workDateFrom?: string;
  workDateTo?: string;
  hasEvidence?: boolean;
  complianceScoreMin?: number;
  searchQuery?: string;
  flags?: string[];
  notInvoiced?: boolean;
}

export interface ProductionLineUpdateRequest {
  status?: ProductionLineStatus;
  billingLineItemId?: string;
  appliedRateCardId?: string;
  rateOverride?: {
    rate: number;
    reason: string;
  };
  flags?: LineFlag[];
  reason?: string;           // Required for certain changes
}

// Invoice Batches
export interface CreateBatchRequest {
  primeContractor: string;
  projectId: string;
  periodStart: string;
  periodEnd: string;
  lineIds: string[];
  paymentTerms?: string;
  internalNotes?: string;
}

export interface UpdateBatchRequest {
  lineIds?: string[];        // Add/remove lines
  paymentTerms?: string;
  customerNotes?: string;
  internalNotes?: string;
  attachmentIds?: string[];
}

export interface SubmitBatchRequest {
  invoiceNumber?: string;    // Auto-generate if not provided
  customerNotes?: string;
  attachmentIds?: string[];
}

export interface RecordPaymentRequest {
  paidAmount: number;
  paidAt: string;
  paymentReference?: string;
  notes?: string;
}

// Rate Cards
export interface CreateRateCardRequest {
  name: string;
  description?: string;
  primeContractor: string;
  projectId?: string;
  region?: string;
  effectiveFrom: string;
  effectiveTo?: string;
  rates: Omit<RateCardItem, 'id'>[];
}

export interface CreateRateCardVersionRequest {
  rates: Omit<RateCardItem, 'id'>[];
  effectiveFrom: string;
  changeNotes?: string;
}

// Validation
export interface RunValidationRequest {
  entityType: 'ProductionLine' | 'InvoiceBatch';
  entityIds: string[];
  ruleIds?: string[];        // Run specific rules only
}

export interface ValidationResponse {
  entityId: string;
  results: ValidationResult[];
  complianceScore: ComplianceScore;
  canProceed: boolean;       // No blocking errors
}

// ============================================
// UI STATE TYPES
// ============================================

export interface InboxState {
  filters: ProductionLineFilters;
  selectedIds: Set<string>;
  expandedId: string | null;
  isCreatingBatch: boolean;
}

export interface ReviewPanelState {
  lineId: string | null;
  isOpen: boolean;
  isDirty: boolean;
  pendingChanges: Partial<ProductionLine>;
}

export interface BatchBuilderState {
  batch: Partial<InvoiceBatch>;
  addedLineIds: Set<string>;
  removedLineIds: Set<string>;
  isDirty: boolean;
  validationRun: boolean;
}
