/**
 * Project Types - Core data structures for the automated workflow
 * NextGen Fiber AI - Zero-Touch System
 */

// ============================================
// ENUMS
// ============================================

export enum ProjectStatus {
  DRAFT = 'draft',                    // Lineman started but not submitted
  SUBMITTED = 'submitted',            // Lineman submitted, waiting AI
  AI_PROCESSING = 'ai_processing',    // AI is analyzing
  AI_COMPLETE = 'ai_complete',        // AI done, ready for review
  NEEDS_ATTENTION = 'needs_attention', // AI found issues
  READY_TO_INVOICE = 'ready_to_invoice', // Approved, ready to bill
  INVOICED = 'invoiced',              // Invoice sent
  PAID = 'paid',                      // Payment received
  DISPUTED = 'disputed',              // Client disputed
  CANCELLED = 'cancelled'             // Cancelled
}

export enum WorkType {
  AERIAL = 'aerial',
  UNDERGROUND = 'underground',
  OVERLASH = 'overlash',
  MIXED = 'mixed'
}

export enum ViolationSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

// ============================================
// INTERFACES
// ============================================

/**
 * Legacy Client interface - for internal billing client
 * @deprecated Use PrimeClient for prime contractors
 */
export interface Client {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  rateCardId: string;
  createdAt: string;
}

/**
 * Prime Client - Who pays us (Prime Contractors)
 * Examples: MasTec, Henkels, Direct
 */
export interface PrimeClient {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * End Customer - Final project operator
 * Examples: Brightspeed, All Points Broadband, AT&T
 */
export interface EndCustomer {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RateCard {
  id: string;
  name: string;
  clientId?: string;              // null = default rates
  rates: {
    fiber_per_foot: number;
    strand_per_foot: number;
    overlash_per_foot: number;
    anchor_each: number;
    coil_each: number;
    snowshoe_each: number;
  };
  effectiveDate: string;
  createdAt: string;
}

export interface Photo {
  id: string;
  filename: string;
  url: string;                    // Base64 or blob URL
  thumbnailUrl?: string;
  metadata: {
    latitude?: number;
    longitude?: number;
    capturedAt?: string;
    deviceModel?: string;
  };
  uploadedAt: string;
  isVerified: boolean;
  aiNotes?: string;               // AI analysis notes
}

export interface Violation {
  id: string;
  code: string;
  severity: ViolationSeverity;
  title: string;
  description: string;
  location?: string;              // Pole ID or footage marker
  suggestion?: string;
  detectedAt: string;
}

export interface LineItem {
  id: string;
  description: string;
  description_pt?: string;        // Portuguese translation
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
  category: 'footage' | 'hardware' | 'labor' | 'other';
}

export interface AIAnalysis {
  processedAt: string;
  processingTimeMs: number;

  // Extracted quantities
  footage: {
    aerial: number;
    underground: number;
    overlash: number;
    total: number;
  };

  hardware: {
    anchors: number;
    coils: number;
    snowshoes: number;
    poles: number;
  };

  // Compliance
  complianceScore: number;        // 0-100
  violations: Violation[];
  nescCompliant: boolean;

  // AI confidence
  confidence: number;             // 0-100
  notes: string;
  notes_pt?: string;              // Portuguese translation

  // Flags for owner attention
  flags: string[];
  requiresReview: boolean;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;          // INV-2024-0001
  projectId: string;
  clientId: string;

  lineItems: LineItem[];
  subtotal: number;
  tax: number;
  taxRate: number;
  total: number;

  status: 'draft' | 'sent' | 'viewed' | 'paid' | 'overdue' | 'disputed';

  createdAt: string;
  sentAt?: string;
  dueDate?: string;
  paidAt?: string;

  pdfUrl_en?: string;
  pdfUrl_pt?: string;

  notes?: string;
  notes_pt?: string;
}

export interface ProjectReport {
  id: string;
  type: 'technical' | 'production' | 'compliance' | 'summary';
  language: 'en' | 'pt';
  generatedAt: string;
  pdfUrl: string;
}

export interface ProjectEvent {
  id: string;
  timestamp: string;
  action: string;
  description: string;
  userId?: string;
  userName?: string;
  metadata?: Record<string, any>;
}

// ============================================
// MAIN PROJECT INTERFACE
// ============================================

export interface Project {
  id: string;
  mapCode: string;                // MAP-2024-001

  // Client & Crew
  clientId: string;
  client?: Client;
  linemanId: string;
  linemanName: string;
  crewId?: string;

  // Status
  status: ProjectStatus;
  statusChangedAt: string;

  // Work details
  workType: WorkType;
  location: {
    address?: string;
    city?: string;
    state?: string;
    coordinates?: { lat: number; lng: number };
  };
  workDate: string;
  description?: string;
  description_pt?: string;

  // Uploads from Lineman
  uploads: {
    mapFile?: {
      filename: string;
      url: string;
      size: number;
      uploadedAt: string;
    };
    photos: Photo[];
    notes?: string;
    submittedAt?: string;
  };

  // AI Analysis
  aiAnalysis?: AIAnalysis;

  // Billing
  rateCardId?: string;
  rateCard?: RateCard;
  lineItems: LineItem[];
  subtotal: number;
  total: number;

  // Invoice
  invoiceId?: string;
  invoice?: Invoice;

  // Reports
  reports: ProjectReport[];

  // Audit trail
  history: ProjectEvent[];

  // Timestamps
  createdAt: string;
  updatedAt: string;
}

// ============================================
// JOB - Work assigned by supervisor to lineman
// ============================================

export enum JobStatus {
  ASSIGNED = 'assigned',           // Job assigned, waiting lineman to start
  IN_PROGRESS = 'in_progress',     // Lineman started working
  SUBMITTED = 'submitted',         // Lineman submitted production sheet
  APPROVED = 'approved',           // Supervisor approved
  NEEDS_REVISION = 'needs_revision', // Supervisor requested changes
  COMPLETED = 'completed'          // Fully complete and paid
}

export interface Job {
  id: string;
  jobCode: string;                 // JOB-2024-001
  title: string;

  // Assignment
  assignedToId: string;            // Lineman user ID
  assignedToName: string;          // Lineman name
  assignedById: string;            // Supervisor user ID
  assignedByName: string;          // Supervisor name
  assignedAt: string;

  // Client (Prime Contractor - who pays us)
  clientId: string;
  clientName: string;

  // Customer (End Operator - final project)
  customerId?: string;
  customerName?: string;

  // Truck assignment
  truckId?: string;

  // Job details
  workType: WorkType;
  location: {
    address?: string;
    city?: string;
    state?: string;
    coordinates?: { lat: number; lng: number };
  };
  scheduledDate?: string;          // When work should be done
  dueDate?: string;                // Deadline
  estimatedFootage?: number;       // Expected footage

  // Map/Documents from supervisor
  mapFile?: {
    filename: string;
    url: string;                   // Base64 or URL to PDF
    size: number;
    uploadedAt: string;
  };

  // Supervisor instructions
  supervisorNotes?: string;
  supervisorNotes_pt?: string;

  // Status
  status: JobStatus;
  statusChangedAt: string;

  // Production Sheet submission (linked when lineman submits)
  // IMPORTANT: Lineman only fills production data. Client/Customer/WorkType come from Job (Admin)
  productionData?: {
    submittedAt: string;
    completedDate?: string;      // Date lineman completed the work
    totalFootage: number;
    anchorCount: number;
    coilCount: number;
    snowshoeCount: number;
    entries: Array<{
      spanFeet: number;
      anchor: boolean;
      fiberNumber: string;
      coil: boolean;
      snowshoe: boolean;
      notes?: string;
    }>;
    photos?: Photo[];
    comments?: string;           // Optional lineman comments
    linemanNotes?: string;       // Deprecated: use comments
  };

  // Project link (created when submitted for invoicing)
  projectId?: string;

  // Timestamps
  createdAt: string;
  updatedAt: string;
}

// ============================================
// JOB CHAT MESSAGES
// ============================================

export type MessageStatus = 'QUEUED' | 'SENDING' | 'SENT' | 'FAILED';

export interface JobChatMessage {
  id: string;
  jobId: string;
  senderUserId: string;
  senderName: string;
  senderRole: 'LINEMAN' | 'ADMIN';
  body: string;
  createdAt: string;
  clientMessageId?: string;      // For offline idempotency
  status?: MessageStatus;
}

export interface JobUnreadCount {
  jobId: string;
  unreadCount: number;
  lastReadAt: string;
}

// ============================================
// DASHBOARD STATS
// ============================================

export interface DashboardStats {
  // Counts
  totalProjects: number;
  pendingAI: number;
  readyToInvoice: number;
  needsAttention: number;
  invoiced: number;
  paid: number;

  // Financials
  totalRevenue: number;
  pendingRevenue: number;
  overdueAmount: number;

  // This week
  submittedThisWeek: number;
  invoicedThisWeek: number;

  // By lineman
  byLineman: {
    id: string;
    name: string;
    submitted: number;
    pending: number;
  }[];

  // By client
  byClient: {
    id: string;
    name: string;
    projects: number;
    revenue: number;
  }[];
}
