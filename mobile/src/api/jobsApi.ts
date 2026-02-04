/**
 * NextGen Fiber - Jobs API Client
 * REST API Contract + Implementation
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Job,
  JobListItem,
  JobStatus,
  ProductionSubmission,
  Comment,
  CreateSubmissionPayload,
  CreateCommentPayload,
  PaginatedResponse,
  User
} from '../types/jobs';

// ============================================
// CONFIGURATION
// ============================================

const API_BASE_URL = __DEV__
  ? 'http://localhost:8000/api/v1'
  : 'https://api.nextgenfiber.com/api/v1';

const AUTH_TOKEN_KEY = 'auth_token';

// ============================================
// HTTP CLIENT
// ============================================

async function getAuthToken(): Promise<string | null> {
  return AsyncStorage.getItem(AUTH_TOKEN_KEY);
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getAuthToken();

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      code: 'UNKNOWN_ERROR',
      message: `HTTP ${response.status}`,
    }));
    throw new ApiError(error.code, error.message, error.details);
  }

  return response.json();
}

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public details: Record<string, string> | null = null
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ============================================
// API ENDPOINTS
// ============================================

/**
 * GET /me
 * Retorna o usuário autenticado
 *
 * Headers:
 *   Authorization: Bearer <jwt_token>
 *
 * Response 200:
 * {
 *   "id": "usr_abc123",
 *   "email": "john@example.com",
 *   "name": "John Smith",
 *   "role": "LINEMAN",
 *   "crewId": "crew_xyz789",
 *   "crewName": "Alpha Crew",
 *   "avatarUrl": "https://...",
 *   "phone": "+1234567890",
 *   "createdAt": "2024-01-15T10:30:00Z"
 * }
 *
 * Response 401:
 * { "code": "UNAUTHORIZED", "message": "Invalid or expired token" }
 */
export async function getCurrentUser(): Promise<User> {
  return apiRequest<User>('/me');
}

/**
 * GET /jobs?status=available|pending|completed&page=1&pageSize=20
 * Lista jobs atribuídos ao usuário autenticado
 *
 * Query Params:
 *   status: 'available' | 'pending' | 'completed' (required)
 *   page: number (default: 1)
 *   pageSize: number (default: 20, max: 50)
 *
 * Mapeamento de status:
 *   - available: AVAILABLE
 *   - pending: IN_PROGRESS, SUBMITTED, NEEDS_INFO
 *   - completed: APPROVED, CLOSED
 *
 * Headers:
 *   Authorization: Bearer <jwt_token>
 *
 * Response 200:
 * {
 *   "data": [
 *     {
 *       "id": "job_123",
 *       "city": "Charlotte",
 *       "state": "NC",
 *       "client": "Brightspeed",
 *       "olt": "OLT-CLTW-001",
 *       "feederId": "F-2847",
 *       "runNumber": null,
 *       "status": "AVAILABLE",
 *       "priority": "NORMAL",
 *       "dueDate": "2024-02-15",
 *       "submissionCount": 0,
 *       "hasUnreadComments": false,
 *       "lastActivityAt": "2024-02-10T14:30:00Z"
 *     }
 *   ],
 *   "pagination": {
 *     "page": 1,
 *     "pageSize": 20,
 *     "totalItems": 45,
 *     "totalPages": 3,
 *     "hasMore": true
 *   }
 * }
 */
export type JobFilter = 'available' | 'pending' | 'completed';

export async function getJobs(
  filter: JobFilter,
  page: number = 1,
  pageSize: number = 20
): Promise<PaginatedResponse<JobListItem>> {
  return apiRequest<PaginatedResponse<JobListItem>>(
    `/jobs?status=${filter}&page=${page}&pageSize=${pageSize}`
  );
}

/**
 * GET /jobs/:id
 * Retorna detalhes completos de um job
 *
 * Path Params:
 *   id: string (job ID)
 *
 * Headers:
 *   Authorization: Bearer <jwt_token>
 *
 * Response 200:
 * {
 *   "id": "job_123",
 *   "city": "Charlotte",
 *   "state": "NC",
 *   "client": "Brightspeed",
 *   "olt": "OLT-CLTW-001",
 *   "feederId": "F-2847",
 *   "runNumber": null,
 *   "status": "AVAILABLE",
 *   "priority": "NORMAL",
 *   "dueDate": "2024-02-15",
 *   "startedAt": null,
 *   "completedAt": null,
 *   "assignedToUserId": "usr_abc123",
 *   "assignedToCrewId": "crew_xyz789",
 *   "assignedByUserId": "usr_admin001",
 *   "assignedAt": "2024-02-10T09:00:00Z",
 *   "instructions": {
 *     "id": "inst_456",
 *     "text": "## Instruções\n\n1. Iniciar no poste MRE#301\n2. Seguir rota até MRE#320\n3. Atenção ao cruzamento na Main St",
 *     "attachments": [
 *       {
 *         "id": "att_789",
 *         "fileName": "safety_guidelines.pdf",
 *         "url": "https://...",
 *         "mimeType": "application/pdf",
 *         "fileSizeBytes": 245000
 *       }
 *     ],
 *     "updatedAt": "2024-02-10T09:00:00Z"
 *   },
 *   "mapAsset": {
 *     "id": "map_321",
 *     "type": "PDF",
 *     "url": "https://storage.nextgenfiber.com/maps/job_123_map.pdf",
 *     "thumbnailUrl": "https://storage.nextgenfiber.com/maps/job_123_thumb.jpg",
 *     "fileName": "Feeder_F2847_Map.pdf",
 *     "fileSizeBytes": 4500000,
 *     "mimeType": "application/pdf",
 *     "cachedLocally": false,
 *     "localPath": null
 *   },
 *   "formSchema": {
 *     "id": "schema_brightspeed_v2",
 *     "version": 2,
 *     "fields": [
 *       {
 *         "id": "total_footage",
 *         "name": "total_footage",
 *         "label": "Total Footage",
 *         "type": "NUMBER",
 *         "required": true,
 *         "placeholder": "Enter total feet",
 *         "helpText": "Sum of all spans",
 *         "defaultValue": null,
 *         "options": null,
 *         "validation": { "min": 0, "max": 100000 },
 *         "order": 1
 *       },
 *       {
 *         "id": "cable_type",
 *         "name": "cable_type",
 *         "label": "Cable Type",
 *         "type": "SELECT",
 *         "required": true,
 *         "placeholder": "Select cable type",
 *         "helpText": null,
 *         "defaultValue": null,
 *         "options": [
 *           { "value": "144F", "label": "144 Fiber" },
 *           { "value": "288F", "label": "288 Fiber" },
 *           { "value": "432F", "label": "432 Fiber" }
 *         ],
 *         "validation": null,
 *         "order": 2
 *       },
 *       {
 *         "id": "anchor_count",
 *         "name": "anchor_count",
 *         "label": "Anchor Count",
 *         "type": "NUMBER",
 *         "required": true,
 *         "placeholder": "0",
 *         "helpText": "Number of anchors installed",
 *         "defaultValue": 0,
 *         "options": null,
 *         "validation": { "min": 0, "max": 500 },
 *         "order": 3
 *       },
 *       {
 *         "id": "notes",
 *         "name": "notes",
 *         "label": "Notes",
 *         "type": "TEXTAREA",
 *         "required": false,
 *         "placeholder": "Any additional notes...",
 *         "helpText": null,
 *         "defaultValue": null,
 *         "options": null,
 *         "validation": { "maxLength": 2000 },
 *         "order": 4
 *       }
 *     ]
 *   },
 *   "submissionCount": 1,
 *   "commentCount": 3,
 *   "lastActivityAt": "2024-02-12T16:45:00Z",
 *   "createdAt": "2024-02-10T08:00:00Z",
 *   "updatedAt": "2024-02-12T16:45:00Z"
 * }
 *
 * Response 404:
 * { "code": "JOB_NOT_FOUND", "message": "Job not found or not assigned to you" }
 */
export async function getJobDetail(jobId: string): Promise<Job> {
  return apiRequest<Job>(`/jobs/${jobId}`);
}

/**
 * POST /jobs/:id/start
 * Marca o job como "Em Progresso"
 *
 * Path Params:
 *   id: string (job ID)
 *
 * Headers:
 *   Authorization: Bearer <jwt_token>
 *
 * Request Body: (empty)
 *
 * Response 200:
 * {
 *   "id": "job_123",
 *   "status": "IN_PROGRESS",
 *   "startedAt": "2024-02-12T08:30:00Z"
 * }
 *
 * Response 400:
 * { "code": "INVALID_STATUS_TRANSITION", "message": "Job already started" }
 */
export async function startJob(
  jobId: string
): Promise<{ id: string; status: JobStatus; startedAt: string }> {
  return apiRequest<{ id: string; status: JobStatus; startedAt: string }>(
    `/jobs/${jobId}/start`,
    { method: 'POST' }
  );
}

/**
 * POST /jobs/:id/submissions
 * Envia produção para um job
 *
 * Path Params:
 *   id: string (job ID)
 *
 * Headers:
 *   Authorization: Bearer <jwt_token>
 *   X-Idempotency-Key: <uuid> (para retry seguro)
 *
 * Request Body:
 * {
 *   "completionDate": "2024-02-12",
 *   "formData": {
 *     "total_footage": 2847,
 *     "cable_type": "144F",
 *     "anchor_count": 12,
 *     "notes": "Completed without issues"
 *   }
 * }
 *
 * Response 201:
 * {
 *   "id": "sub_abc123",
 *   "jobId": "job_123",
 *   "formData": { ... },
 *   "completionDate": "2024-02-12",
 *   "submittedByUserId": "usr_abc123",
 *   "submittedByName": "John Smith",
 *   "submittedAt": "2024-02-12T17:30:00Z"
 * }
 *
 * Response 400:
 * {
 *   "code": "VALIDATION_ERROR",
 *   "message": "Invalid form data",
 *   "details": {
 *     "total_footage": "Required field",
 *     "cable_type": "Invalid option"
 *   }
 * }
 */
export async function createSubmission(
  jobId: string,
  payload: Omit<CreateSubmissionPayload, 'jobId'>,
  idempotencyKey: string
): Promise<ProductionSubmission> {
  return apiRequest<ProductionSubmission>(`/jobs/${jobId}/submissions`, {
    method: 'POST',
    headers: {
      'X-Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(payload),
  });
}

/**
 * GET /jobs/:id/submissions
 * Lista submissions de um job
 *
 * Path Params:
 *   id: string (job ID)
 *
 * Headers:
 *   Authorization: Bearer <jwt_token>
 *
 * Response 200:
 * {
 *   "data": [
 *     {
 *       "id": "sub_abc123",
 *       "jobId": "job_123",
 *       "formData": {
 *         "total_footage": 2847,
 *         "cable_type": "144F",
 *         "anchor_count": 12,
 *         "notes": "Completed without issues"
 *       },
 *       "completionDate": "2024-02-12",
 *       "submittedByUserId": "usr_abc123",
 *       "submittedByName": "John Smith",
 *       "submittedAt": "2024-02-12T17:30:00Z",
 *       "syncStatus": "SENT",
 *       "syncError": null,
 *       "syncRetryCount": 0,
 *       "serverSubmissionId": "sub_abc123",
 *       "serverReceivedAt": "2024-02-12T17:30:01Z"
 *     }
 *   ],
 *   "pagination": { ... }
 * }
 */
export async function getSubmissions(
  jobId: string
): Promise<PaginatedResponse<ProductionSubmission>> {
  return apiRequest<PaginatedResponse<ProductionSubmission>>(
    `/jobs/${jobId}/submissions`
  );
}

/**
 * POST /jobs/:id/comments
 * Envia comentário em um job
 *
 * Path Params:
 *   id: string (job ID)
 *
 * Headers:
 *   Authorization: Bearer <jwt_token>
 *   X-Idempotency-Key: <uuid>
 *
 * Request Body:
 * {
 *   "text": "Question about the route near Main St intersection"
 * }
 *
 * Response 201:
 * {
 *   "id": "cmt_xyz789",
 *   "jobId": "job_123",
 *   "authorId": "usr_abc123",
 *   "authorName": "John Smith",
 *   "authorRole": "LINEMAN",
 *   "authorAvatarUrl": "https://...",
 *   "text": "Question about the route near Main St intersection",
 *   "attachments": [],
 *   "createdAt": "2024-02-12T18:00:00Z",
 *   "editedAt": null,
 *   "isFromOffice": false
 * }
 */
export async function createComment(
  jobId: string,
  payload: Omit<CreateCommentPayload, 'jobId'>,
  idempotencyKey: string
): Promise<Comment> {
  return apiRequest<Comment>(`/jobs/${jobId}/comments`, {
    method: 'POST',
    headers: {
      'X-Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(payload),
  });
}

/**
 * GET /jobs/:id/comments?page=1&pageSize=50
 * Lista comentários de um job
 *
 * Path Params:
 *   id: string (job ID)
 *
 * Query Params:
 *   page: number (default: 1)
 *   pageSize: number (default: 50)
 *
 * Headers:
 *   Authorization: Bearer <jwt_token>
 *
 * Response 200:
 * {
 *   "data": [
 *     {
 *       "id": "cmt_xyz789",
 *       "jobId": "job_123",
 *       "authorId": "usr_abc123",
 *       "authorName": "John Smith",
 *       "authorRole": "LINEMAN",
 *       "authorAvatarUrl": "https://...",
 *       "text": "Question about the route near Main St intersection",
 *       "attachments": [],
 *       "createdAt": "2024-02-12T18:00:00Z",
 *       "editedAt": null,
 *       "isFromOffice": false,
 *       "syncStatus": "SENT",
 *       "syncError": null
 *     },
 *     {
 *       "id": "cmt_office001",
 *       "jobId": "job_123",
 *       "authorId": "usr_admin001",
 *       "authorName": "Office Support",
 *       "authorRole": "OFFICE",
 *       "authorAvatarUrl": null,
 *       "text": "Take the alternate route via Oak St. Main St has construction.",
 *       "attachments": [],
 *       "createdAt": "2024-02-12T18:15:00Z",
 *       "editedAt": null,
 *       "isFromOffice": true,
 *       "syncStatus": "SENT",
 *       "syncError": null
 *     }
 *   ],
 *   "pagination": { ... }
 * }
 */
export async function getComments(
  jobId: string,
  page: number = 1,
  pageSize: number = 50
): Promise<PaginatedResponse<Comment>> {
  return apiRequest<PaginatedResponse<Comment>>(
    `/jobs/${jobId}/comments?page=${page}&pageSize=${pageSize}`
  );
}

// ============================================
// DOWNLOAD HELPERS
// ============================================

/**
 * Download map asset for offline use
 */
export async function downloadMapAsset(
  mapAsset: {
    url: string;
    type: string;
  },
  localPath: string
): Promise<void> {
  const token = await getAuthToken();

  const response = await fetch(mapAsset.url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!response.ok) {
    throw new Error(`Failed to download map: ${response.status}`);
  }

  // In React Native, use react-native-fs to save to localPath
  // This is a placeholder - actual implementation depends on platform
  const blob = await response.blob();
  // await RNFS.writeFile(localPath, blob, 'base64');
}
