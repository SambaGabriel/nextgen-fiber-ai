/**
 * NextGen Fiber - Jobs/Tasks Type Definitions
 * Mobile Field Application
 */

// ============================================
// ENUMS
// ============================================

export enum JobStatus {
  AVAILABLE = 'AVAILABLE',       // Atribuído, não iniciado
  IN_PROGRESS = 'IN_PROGRESS',   // Lineman iniciou o trabalho
  SUBMITTED = 'SUBMITTED',       // Produção enviada, aguardando revisão
  NEEDS_INFO = 'NEEDS_INFO',     // Escritório pediu mais informações
  APPROVED = 'APPROVED',         // Aprovado pelo escritório
  CLOSED = 'CLOSED',             // Fechado/Concluído
  REJECTED = 'REJECTED'          // Rejeitado (raro)
}

export enum SubmissionStatus {
  QUEUED = 'QUEUED',             // Na fila local, aguardando conexão
  SENDING = 'SENDING',           // Enviando para servidor
  SENT = 'SENT',                 // Enviado com sucesso
  FAILED = 'FAILED'              // Falhou, precisa retry
}

export enum FormFieldType {
  TEXT = 'TEXT',
  NUMBER = 'NUMBER',
  SELECT = 'SELECT',
  DATE = 'DATE',
  TEXTAREA = 'TEXTAREA',
  PHOTO = 'PHOTO'                // Futuro
}

export enum MapAssetType {
  IMAGE = 'IMAGE',               // PNG, JPG
  PDF = 'PDF',
  EXTERNAL_LINK = 'EXTERNAL_LINK'
}

// ============================================
// USER
// ============================================

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'LINEMAN' | 'FOREMAN' | 'ADMIN';
  crewId: string | null;
  crewName: string | null;
  avatarUrl: string | null;
  phone: string | null;
  createdAt: string;
}

// ============================================
// JOB / RUN
// ============================================

export interface Job {
  id: string;

  // Identificação
  city: string;
  state: string;
  client: string;                // Brightspeed, Spectrum, etc.
  olt: string;                   // OLT identifier
  feederId: string | null;       // Feeder ID (se aplicável)
  runNumber: string | null;      // Run Number (se aplicável)

  // Status e datas
  status: JobStatus;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  dueDate: string | null;        // ISO date
  startedAt: string | null;
  completedAt: string | null;

  // Atribuição
  assignedToUserId: string | null;
  assignedToCrewId: string | null;
  assignedByUserId: string;
  assignedAt: string;

  // Conteúdo
  instructions: Instruction | null;
  mapAsset: MapAsset | null;
  formSchema: FormSchema;        // Schema dinâmico do formulário

  // Metadados
  submissionCount: number;
  commentCount: number;
  lastActivityAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface JobListItem {
  id: string;
  city: string;
  state: string;
  client: string;
  olt: string;
  feederId: string | null;
  runNumber: string | null;
  status: JobStatus;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  dueDate: string | null;
  submissionCount: number;
  hasUnreadComments: boolean;
  lastActivityAt: string;
}

// ============================================
// MAP ASSET
// ============================================

export interface MapAsset {
  id: string;
  type: MapAssetType;
  url: string;                   // URL para download/visualização
  thumbnailUrl: string | null;   // Preview thumbnail
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
  cachedLocally: boolean;        // Flag para offline
  localPath: string | null;      // Caminho local se cacheado
}

// ============================================
// INSTRUCTIONS
// ============================================

export interface Instruction {
  id: string;
  text: string;                  // Markdown ou texto simples
  attachments: InstructionAttachment[];
  updatedAt: string;
}

export interface InstructionAttachment {
  id: string;
  fileName: string;
  url: string;
  mimeType: string;
  fileSizeBytes: number;
}

// ============================================
// DYNAMIC FORM SCHEMA
// ============================================

export interface FormSchema {
  id: string;
  version: number;
  fields: FormField[];
}

export interface FormField {
  id: string;
  name: string;                  // Campo técnico (snake_case)
  label: string;                 // Label para UI
  type: FormFieldType;
  required: boolean;
  placeholder: string | null;
  helpText: string | null;
  defaultValue: string | number | null;

  // Para SELECT
  options: FormFieldOption[] | null;

  // Validação
  validation: FormFieldValidation | null;

  // Ordem de exibição
  order: number;
}

export interface FormFieldOption {
  value: string;
  label: string;
}

export interface FormFieldValidation {
  min: number | null;            // Para NUMBER
  max: number | null;
  minLength: number | null;      // Para TEXT
  maxLength: number | null;
  pattern: string | null;        // Regex
  patternMessage: string | null; // Mensagem se falhar regex
}

// ============================================
// PRODUCTION SUBMISSION
// ============================================

export interface ProductionSubmission {
  id: string;
  jobId: string;

  // Dados do formulário (dinâmico)
  formData: Record<string, string | number | null>;

  // Data de conclusão informada pelo lineman
  completionDate: string;        // ISO date

  // Metadados
  submittedByUserId: string;
  submittedByName: string;
  submittedAt: string;

  // Status de sincronização (local)
  syncStatus: SubmissionStatus;
  syncError: string | null;
  syncRetryCount: number;

  // Resposta do servidor (após sync)
  serverSubmissionId: string | null;
  serverReceivedAt: string | null;
}

// Para criação local
export interface CreateSubmissionPayload {
  jobId: string;
  completionDate: string;
  formData: Record<string, string | number | null>;
}

// ============================================
// COMMENTS
// ============================================

export interface Comment {
  id: string;
  jobId: string;

  // Autor
  authorId: string;
  authorName: string;
  authorRole: 'LINEMAN' | 'FOREMAN' | 'ADMIN' | 'OFFICE';
  authorAvatarUrl: string | null;

  // Conteúdo
  text: string;
  attachments: CommentAttachment[];

  // Metadados
  createdAt: string;
  editedAt: string | null;
  isFromOffice: boolean;         // Flag visual para destacar mensagens do escritório

  // Status de sincronização (local)
  syncStatus: SubmissionStatus;
  syncError: string | null;
}

export interface CommentAttachment {
  id: string;
  fileName: string;
  url: string;
  mimeType: string;
  fileSizeBytes: number;
}

export interface CreateCommentPayload {
  jobId: string;
  text: string;
}

// ============================================
// OFFLINE QUEUE
// ============================================

export interface QueuedAction {
  id: string;                    // UUID local
  type: 'SUBMISSION' | 'COMMENT' | 'START_JOB';
  payload: CreateSubmissionPayload | CreateCommentPayload | { jobId: string };
  status: SubmissionStatus;
  error: string | null;
  retryCount: number;
  maxRetries: number;
  createdAt: string;
  lastAttemptAt: string | null;
}

// ============================================
// API RESPONSES
// ============================================

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export interface ApiError {
  code: string;
  message: string;
  details: Record<string, string> | null;
}

// ============================================
// TELEMETRY EVENTS
// ============================================

export type TelemetryEvent =
  | { type: 'JOB_LIST_VIEWED'; filter: string }
  | { type: 'JOB_OPENED'; jobId: string }
  | { type: 'MAP_VIEWED'; jobId: string; assetType: MapAssetType }
  | { type: 'MAP_ZOOMED'; jobId: string }
  | { type: 'SUBMISSION_STARTED'; jobId: string }
  | { type: 'SUBMISSION_SENT'; jobId: string; offline: boolean }
  | { type: 'SUBMISSION_FAILED'; jobId: string; error: string }
  | { type: 'COMMENT_SENT'; jobId: string; offline: boolean }
  | { type: 'OFFLINE_QUEUE_SYNCED'; count: number };
