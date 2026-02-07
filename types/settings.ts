/**
 * Settings Types
 * TypeScript interfaces for the Settings CRM module
 */

// ============================================
// USER PROFILE
// ============================================

export type UserRole = 'admin' | 'supervisor' | 'billing' | 'viewer' | 'lineman' | 'redline_specialist' | 'client_reviewer';

export interface UserProfile {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone?: string;
    avatarUrl?: string;
    role: UserRole;
    organizationId?: string;
    organizationName?: string;
    isActive: boolean;
    createdAt: string;
    lastLoginAt?: string;
}

export interface ProfileUpdateRequest {
    firstName?: string;
    lastName?: string;
    phone?: string;
    avatarUrl?: string;
}

// ============================================
// USER PREFERENCES
// ============================================

export type SupportedLanguage = 'en' | 'pt-br' | 'es';
export type Theme = 'light' | 'dark' | 'system';
export type DateFormat = 'MM/DD/YYYY' | 'DD/MM/YYYY';

export interface NotificationPreferences {
    email: {
        jobAssigned: boolean;
        jobUpdated: boolean;
        newMessage: boolean;
        rateCardImport: boolean;
        productionSubmitted: boolean;
        redlineCreated: boolean;
        redlineReviewed: boolean;
    };
    inApp: {
        jobAssigned: boolean;
        jobUpdated: boolean;
        newMessage: boolean;
        rateCardImport: boolean;
        productionSubmitted: boolean;
        redlineCreated: boolean;
        redlineReviewed: boolean;
    };
}

export interface UserPreferences {
    userId: string;
    language: SupportedLanguage;
    timezone: string;
    dateFormat: DateFormat;
    theme: Theme;
    notifications: NotificationPreferences;
}

export interface PreferencesUpdateRequest {
    language?: SupportedLanguage;
    timezone?: string;
    dateFormat?: DateFormat;
    theme?: Theme;
    notifications?: Partial<NotificationPreferences>;
}

// Default notification preferences
export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
    email: {
        jobAssigned: true,
        jobUpdated: true,
        newMessage: true,
        rateCardImport: true,
        productionSubmitted: true,
        redlineCreated: true,
        redlineReviewed: true
    },
    inApp: {
        jobAssigned: true,
        jobUpdated: true,
        newMessage: true,
        rateCardImport: true,
        productionSubmitted: true,
        redlineCreated: true,
        redlineReviewed: true
    }
};

// ============================================
// SESSIONS
// ============================================

export interface UserSession {
    id: string;
    userId: string;
    deviceInfo: string;
    browser: string;
    os: string;
    ipAddress: string;
    location?: string;
    lastActivityAt: string;
    createdAt: string;
    isCurrent: boolean;
}

// ============================================
// SECURITY / PASSWORD
// ============================================

export interface ChangePasswordRequest {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
}

export interface ChangePasswordResponse {
    success: boolean;
    message: string;
    sessionsRevoked?: number;
}

export type PasswordStrength = 'weak' | 'fair' | 'good' | 'strong' | 'very-strong';

export interface PasswordRequirements {
    minLength: number;
    hasUppercase: boolean;
    hasLowercase: boolean;
    hasNumber: boolean;
    hasSpecialChar: boolean;
}

// ============================================
// TEAM MANAGEMENT
// ============================================

export interface TeamMember extends UserProfile {
    // Additional team-specific fields
}

export interface InviteUserRequest {
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
}

export interface InviteUserResponse {
    success: boolean;
    message: string;
    userId?: string;
}

export interface UpdateUserRoleRequest {
    userId: string;
    role: UserRole;
}

// ============================================
// ORGANIZATION
// ============================================

export interface Organization {
    id: string;
    name: string;
    address?: string;
    phone?: string;
    logoUrl?: string;
    primaryColor?: string;
    createdAt: string;
    updatedAt: string;
}

export interface OrganizationUpdateRequest {
    name?: string;
    address?: string;
    phone?: string;
    logoUrl?: string;
    primaryColor?: string;
}

// ============================================
// AUDIT LOG
// ============================================

export type AuditAction =
    | 'login'
    | 'logout'
    | 'password_change'
    | 'profile_update'
    | 'preferences_update'
    | 'user_invite'
    | 'user_role_change'
    | 'user_deactivate'
    | 'user_reactivate'
    | 'session_revoke'
    | 'job_create'
    | 'job_update'
    | 'job_delete'
    | 'rate_card_import'
    | 'rate_card_update'
    | 'production_submit';

export type AuditEntityType =
    | 'user'
    | 'session'
    | 'job'
    | 'rate_card'
    | 'production'
    | 'organization'
    | 'system';

export interface AuditEvent {
    id: string;
    action: AuditAction;
    entityType: AuditEntityType;
    entityId?: string;
    userId: string;
    userEmail: string;
    userRole: string;
    ipAddress?: string;
    oldValues?: Record<string, any>;
    newValues?: Record<string, any>;
    metadata?: Record<string, any>;
    isSuccess: boolean;
    errorMessage?: string;
    createdAt: string;
}

export interface AuditLogFilters {
    startDate?: string;
    endDate?: string;
    action?: AuditAction;
    userId?: string;
    entityType?: AuditEntityType;
    isSuccess?: boolean;
}

export interface AuditLogResponse {
    events: AuditEvent[];
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
}

// ============================================
// SETTINGS TAB TYPES
// ============================================

export type SettingsTabId =
    | 'account'
    | 'security'
    | 'preferences'
    | 'notifications'
    | 'team'
    | 'organization'
    | 'audit';

export interface SettingsTab {
    id: SettingsTabId;
    labelKey: string;  // Translation key
    icon: string;      // Lucide icon name
    roles: UserRole[] | ['*'];  // Allowed roles, '*' means all
}

export const SETTINGS_TABS: SettingsTab[] = [
    { id: 'account', labelKey: 'settings_account', icon: 'User', roles: ['*'] },
    { id: 'security', labelKey: 'settings_security', icon: 'Shield', roles: ['*'] },
    { id: 'preferences', labelKey: 'settings_preferences', icon: 'Settings', roles: ['*'] },
    { id: 'notifications', labelKey: 'settings_notifications', icon: 'Bell', roles: ['*'] },
    { id: 'team', labelKey: 'settings_team', icon: 'Users', roles: ['admin'] },
    { id: 'organization', labelKey: 'settings_organization', icon: 'Building', roles: ['admin'] },
    { id: 'audit', labelKey: 'settings_audit', icon: 'FileText', roles: ['admin', 'supervisor'] }
];

// ============================================
// COMMON TIMEZONES
// ============================================

export const COMMON_TIMEZONES = [
    { value: 'America/New_York', label: 'Eastern Time (ET)' },
    { value: 'America/Chicago', label: 'Central Time (CT)' },
    { value: 'America/Denver', label: 'Mountain Time (MT)' },
    { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
    { value: 'America/Phoenix', label: 'Arizona (No DST)' },
    { value: 'America/Anchorage', label: 'Alaska Time' },
    { value: 'Pacific/Honolulu', label: 'Hawaii Time' },
    { value: 'America/Sao_Paulo', label: 'Brasilia Time (BRT)' },
    { value: 'Europe/London', label: 'London (GMT/BST)' },
    { value: 'Europe/Paris', label: 'Central European Time' },
    { value: 'UTC', label: 'UTC' }
];

// ============================================
// API RESPONSE TYPES
// ============================================

export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}

export interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
}
