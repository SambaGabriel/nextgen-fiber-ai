/**
 * API Client V2
 * HTTP client with JWT authentication and feature flag awareness
 */

// Types for API responses
interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

interface UserResponse {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  role: string;
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
}

interface LoginResponse extends TokenPair {
  user: UserResponse;
}

interface MapResponse {
  id: string;
  filename: string;
  file_size: number;
  mime_type: string;
  status: string;
  project_id?: string;
  location?: string;
  overall_confidence?: number;
  totals?: Record<string, number>;
  error_message?: string;
  download_url?: string;
  created_at: string;
  updated_at: string;
}

interface JobResponse {
  id: string;
  job_code: string;
  title: string;
  source_map_id?: string;
  assigned_to_id?: string;
  assigned_to_name?: string;
  client_id?: string;
  client_name?: string;
  work_type: string;
  location?: {
    address?: string;
    city?: string;
    state?: string;
  };
  scheduled_date?: string;
  due_date?: string;
  estimated_footage?: number;
  actual_footage?: number;
  status: string;
  supervisor_notes?: string;
  lineman_notes?: string;
  production_data?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

// Storage keys
const TOKEN_STORAGE_KEY = 'fs_auth_tokens';
const USER_STORAGE_KEY = 'fs_auth_user';

// API configuration
const API_BASE_URL = import.meta.env.VITE_API_V2_URL || 'http://localhost:8000/api/v2';

/**
 * API Client V2 with JWT authentication
 */
class ApiClientV2 {
  private baseUrl: string;
  private tokens: TokenPair | null = null;
  private user: UserResponse | null = null;
  private refreshPromise: Promise<void> | null = null;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
    this.loadFromStorage();
  }

  // =========================================
  // Token Management
  // =========================================

  private loadFromStorage(): void {
    try {
      const tokensJson = localStorage.getItem(TOKEN_STORAGE_KEY);
      const userJson = localStorage.getItem(USER_STORAGE_KEY);

      if (tokensJson) {
        this.tokens = JSON.parse(tokensJson);
      }
      if (userJson) {
        this.user = JSON.parse(userJson);
      }
    } catch (e) {
      console.warn('[ApiClientV2] Failed to load from storage:', e);
    }
  }

  private saveToStorage(): void {
    try {
      if (this.tokens) {
        localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(this.tokens));
      } else {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
      }
      if (this.user) {
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(this.user));
      } else {
        localStorage.removeItem(USER_STORAGE_KEY);
      }
    } catch (e) {
      console.warn('[ApiClientV2] Failed to save to storage:', e);
    }
  }

  get isAuthenticated(): boolean {
    return this.tokens !== null;
  }

  get currentUser(): UserResponse | null {
    return this.user;
  }

  get accessToken(): string | null {
    return this.tokens?.access_token ?? null;
  }

  // =========================================
  // HTTP Methods
  // =========================================

  private async request<T>(
    method: string,
    path: string,
    options: {
      body?: any;
      params?: Record<string, string | number | undefined>;
      headers?: Record<string, string>;
      requireAuth?: boolean;
    } = {}
  ): Promise<T> {
    const { body, params, headers = {}, requireAuth = true } = options;

    // Build URL with query params
    let url = `${this.baseUrl}${path}`;
    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, String(value));
        }
      });
      const queryString = searchParams.toString();
      if (queryString) {
        url += `?${queryString}`;
      }
    }

    // Build headers
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...headers,
    };

    // Add auth header if required
    if (requireAuth && this.tokens) {
      requestHeaders['Authorization'] = `Bearer ${this.tokens.access_token}`;
    }

    // Make request
    const response = await fetch(url, {
      method,
      headers: requestHeaders,
      body: body ? JSON.stringify(body) : undefined,
    });

    // Handle 401 - try refresh
    if (response.status === 401 && requireAuth && this.tokens?.refresh_token) {
      await this.refreshTokens();
      // Retry with new token
      requestHeaders['Authorization'] = `Bearer ${this.tokens!.access_token}`;
      const retryResponse = await fetch(url, {
        method,
        headers: requestHeaders,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!retryResponse.ok) {
        throw await this.handleError(retryResponse);
      }
      return retryResponse.json();
    }

    if (!response.ok) {
      throw await this.handleError(response);
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return undefined as T;
    }

    return response.json();
  }

  private async handleError(response: Response): Promise<Error> {
    let message = `HTTP ${response.status}: ${response.statusText}`;
    try {
      const body = await response.json();
      if (body.detail) {
        message = body.detail;
      }
    } catch {
      // Ignore JSON parse errors
    }
    return new Error(message);
  }

  private async refreshTokens(): Promise<void> {
    // Prevent concurrent refresh calls
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      try {
        const response = await fetch(`${this.baseUrl}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: this.tokens!.refresh_token }),
        });

        if (!response.ok) {
          // Refresh failed, clear tokens
          this.logout();
          throw new Error('Session expired');
        }

        const newTokens: TokenPair = await response.json();
        this.tokens = newTokens;
        this.saveToStorage();
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  // =========================================
  // Auth Endpoints
  // =========================================

  async login(email: string, password: string): Promise<LoginResponse> {
    const response = await this.request<LoginResponse>('POST', '/auth/login', {
      body: { email, password },
      requireAuth: false,
    });

    this.tokens = {
      access_token: response.access_token,
      refresh_token: response.refresh_token,
      token_type: response.token_type,
      expires_in: response.expires_in,
    };
    this.user = response.user;
    this.saveToStorage();

    return response;
  }

  logout(): void {
    // Fire and forget logout call
    if (this.tokens) {
      fetch(`${this.baseUrl}/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.tokens.access_token}` },
      }).catch(() => {});
    }

    this.tokens = null;
    this.user = null;
    this.saveToStorage();
  }

  async getMe(): Promise<UserResponse> {
    return this.request<UserResponse>('GET', '/auth/me');
  }

  async getPermissions(): Promise<{ permissions: string[] }> {
    return this.request<{ permissions: string[] }>('GET', '/auth/permissions');
  }

  // =========================================
  // Maps Endpoints
  // =========================================

  async uploadMap(
    file: File,
    options: { projectId?: string; autoProcess?: boolean; priority?: number } = {}
  ): Promise<MapResponse> {
    const formData = new FormData();
    formData.append('file', file);
    if (options.projectId) formData.append('project_id', options.projectId);
    if (options.autoProcess !== undefined) formData.append('auto_process', String(options.autoProcess));
    if (options.priority !== undefined) formData.append('priority', String(options.priority));

    const response = await fetch(`${this.baseUrl}/maps`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.tokens?.access_token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      throw await this.handleError(response);
    }

    return response.json();
  }

  async getMaps(params: {
    status?: string;
    projectId?: string;
    page?: number;
    pageSize?: number;
  } = {}): Promise<PaginatedResponse<MapResponse>> {
    return this.request<PaginatedResponse<MapResponse>>('GET', '/maps', {
      params: {
        status: params.status,
        project_id: params.projectId,
        page: params.page,
        page_size: params.pageSize,
      },
    });
  }

  async getMap(mapId: string): Promise<MapResponse> {
    return this.request<MapResponse>('GET', `/maps/${mapId}`);
  }

  async getMapStatus(mapId: string): Promise<{
    id: string;
    status: string;
    progress?: number;
    error_message?: string;
  }> {
    return this.request('GET', `/maps/${mapId}/status`);
  }

  async reprocessMap(mapId: string, reason: string, priority: number = 10): Promise<void> {
    await this.request('POST', `/maps/${mapId}/reprocess`, {
      body: { reason, priority },
    });
  }

  // =========================================
  // Jobs Endpoints
  // =========================================

  async getJobs(params: {
    status?: string;
    assignedToId?: string;
    clientId?: string;
    page?: number;
    pageSize?: number;
  } = {}): Promise<PaginatedResponse<JobResponse>> {
    return this.request<PaginatedResponse<JobResponse>>('GET', '/jobs', {
      params: {
        status: params.status,
        assigned_to_id: params.assignedToId,
        client_id: params.clientId,
        page: params.page,
        page_size: params.pageSize,
      },
    });
  }

  async getMyJobs(params: {
    status?: string;
    page?: number;
    pageSize?: number;
  } = {}): Promise<PaginatedResponse<JobResponse>> {
    return this.request<PaginatedResponse<JobResponse>>('GET', '/jobs/my-jobs', {
      params: {
        status: params.status,
        page: params.page,
        page_size: params.pageSize,
      },
    });
  }

  async getJob(jobId: string): Promise<JobResponse> {
    return this.request<JobResponse>('GET', `/jobs/${jobId}`);
  }

  async createJob(data: {
    title: string;
    assignedToId?: string;
    clientId?: string;
    clientName?: string;
    workType?: string;
    location?: { address?: string; city?: string; state?: string };
    scheduledDate?: string;
    estimatedFootage?: number;
    supervisorNotes?: string;
    sourceMapId?: string;
  }): Promise<JobResponse> {
    return this.request<JobResponse>('POST', '/jobs', {
      body: {
        title: data.title,
        assigned_to_id: data.assignedToId,
        client_id: data.clientId,
        client_name: data.clientName,
        work_type: data.workType || 'aerial',
        location: data.location,
        scheduled_date: data.scheduledDate,
        estimated_footage: data.estimatedFootage,
        supervisor_notes: data.supervisorNotes,
        source_map_id: data.sourceMapId,
      },
    });
  }

  async updateJobStatus(
    jobId: string,
    status: string,
    notes?: string
  ): Promise<JobResponse> {
    return this.request<JobResponse>('PATCH', `/jobs/${jobId}/status`, {
      body: { status, notes },
    });
  }

  async submitProduction(
    jobId: string,
    productionData: {
      totalFootage: number;
      anchorCount?: number;
      coilCount?: number;
      snowshoeCount?: number;
      entries?: Array<{
        spanFeet: number;
        anchor?: boolean;
        coil?: boolean;
        snowshoe?: boolean;
      }>;
    },
    notes?: string
  ): Promise<JobResponse> {
    return this.request<JobResponse>('POST', `/jobs/${jobId}/submit-production`, {
      body: {
        production_data: {
          total_footage: productionData.totalFootage,
          anchor_count: productionData.anchorCount || 0,
          coil_count: productionData.coilCount || 0,
          snowshoe_count: productionData.snowshoeCount || 0,
          entries: productionData.entries || [],
          photos: [],
        },
        notes,
      },
    });
  }

  async getJobStats(assignedToId?: string): Promise<{
    total: number;
    assigned: number;
    in_progress: number;
    submitted: number;
    completed: number;
  }> {
    return this.request('GET', '/jobs/stats', {
      params: { assigned_to_id: assignedToId },
    });
  }
}

// Export singleton instance
export const apiClientV2 = new ApiClientV2();

// Export class for testing
export { ApiClientV2 };
export type {
  TokenPair,
  UserResponse,
  LoginResponse,
  MapResponse,
  JobResponse,
  PaginatedResponse,
};
