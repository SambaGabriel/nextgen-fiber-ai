/**
 * Settings Service
 * API client for Settings module - profile, preferences, sessions, audit
 */

import { supabase, authService } from './supabase';
import {
    UserProfile,
    ProfileUpdateRequest,
    UserPreferences,
    PreferencesUpdateRequest,
    UserSession,
    ChangePasswordRequest,
    ChangePasswordResponse,
    TeamMember,
    InviteUserRequest,
    InviteUserResponse,
    UpdateUserRoleRequest,
    Organization,
    OrganizationUpdateRequest,
    AuditEvent,
    AuditLogFilters,
    AuditLogResponse,
    DEFAULT_NOTIFICATION_PREFERENCES,
    PasswordStrength,
    UserRole
} from '../types/settings';

// ============================================
// PASSWORD UTILITIES
// ============================================

/**
 * Calculate password strength based on requirements
 */
export function getPasswordStrength(password: string): PasswordStrength {
    let score = 0;

    if (password.length >= 8) score++;
    if (password.length >= 10) score++;
    if (password.length >= 14) score++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score++;

    if (score <= 1) return 'weak';
    if (score === 2) return 'fair';
    if (score === 3) return 'good';
    if (score === 4) return 'strong';
    return 'very-strong';
}

/**
 * Validate password meets requirements
 */
export function validatePassword(password: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (password.length < 10) {
        errors.push('Password must be at least 10 characters');
    }
    if (!/[a-z]/.test(password)) {
        errors.push('Password must contain a lowercase letter');
    }
    if (!/[A-Z]/.test(password)) {
        errors.push('Password must contain an uppercase letter');
    }
    if (!/\d/.test(password)) {
        errors.push('Password must contain a number');
    }

    return { valid: errors.length === 0, errors };
}

// ============================================
// PROFILE SERVICE
// ============================================

export const profileService = {
    /**
     * Get current user's profile
     */
    async getProfile(): Promise<UserProfile | null> {
        try {
            const user = await authService.getUser();
            if (!user) return null;

            // Get profile from profiles table
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();

            if (error) {
                console.error('[ProfileService] Error fetching profile:', error);
                // Return basic profile from auth user
                return {
                    id: user.id,
                    email: user.email || '',
                    firstName: user.user_metadata?.name?.split(' ')[0] || '',
                    lastName: user.user_metadata?.name?.split(' ').slice(1).join(' ') || '',
                    role: (user.user_metadata?.role?.toLowerCase() as UserRole) || 'lineman',
                    isActive: true,
                    createdAt: user.created_at
                };
            }

            return {
                id: data.id,
                email: data.email,
                firstName: data.first_name || data.name?.split(' ')[0] || '',
                lastName: data.last_name || data.name?.split(' ').slice(1).join(' ') || '',
                phone: data.phone,
                avatarUrl: data.avatar_url,
                role: (data.role?.toLowerCase() as UserRole) || 'lineman',
                organizationId: data.organization_id,
                organizationName: data.company_name,
                isActive: data.is_active !== false,
                createdAt: data.created_at,
                lastLoginAt: data.last_login_at
            };
        } catch (error) {
            console.error('[ProfileService] getProfile error:', error);
            return null;
        }
    },

    /**
     * Update current user's profile
     */
    async updateProfile(updates: ProfileUpdateRequest): Promise<UserProfile | null> {
        try {
            const user = await authService.getUser();
            if (!user) throw new Error('Not authenticated');

            const updateData: Record<string, any> = {};
            if (updates.firstName !== undefined) updateData.first_name = updates.firstName;
            if (updates.lastName !== undefined) updateData.last_name = updates.lastName;
            if (updates.phone !== undefined) updateData.phone = updates.phone;
            if (updates.avatarUrl !== undefined) updateData.avatar_url = updates.avatarUrl;

            // Also update the combined name field for backwards compatibility
            if (updates.firstName !== undefined || updates.lastName !== undefined) {
                const profile = await this.getProfile();
                const firstName = updates.firstName ?? profile?.firstName ?? '';
                const lastName = updates.lastName ?? profile?.lastName ?? '';
                updateData.name = `${firstName} ${lastName}`.trim();
            }

            const { error } = await supabase
                .from('profiles')
                .update(updateData)
                .eq('id', user.id);

            if (error) {
                console.error('[ProfileService] Error updating profile:', error);
                throw error;
            }

            return this.getProfile();
        } catch (error) {
            console.error('[ProfileService] updateProfile error:', error);
            throw error;
        }
    }
};

// ============================================
// PREFERENCES SERVICE
// ============================================

export const preferencesService = {
    /**
     * Get current user's preferences
     */
    async getPreferences(): Promise<UserPreferences | null> {
        try {
            const user = await authService.getUser();
            if (!user) return null;

            const { data, error } = await supabase
                .from('user_preferences')
                .select('*')
                .eq('user_id', user.id)
                .single();

            if (error || !data) {
                // Return defaults if no preferences exist
                return {
                    userId: user.id,
                    language: 'en',
                    timezone: 'America/New_York',
                    dateFormat: 'MM/DD/YYYY',
                    theme: 'system',
                    notifications: DEFAULT_NOTIFICATION_PREFERENCES
                };
            }

            return {
                userId: data.user_id,
                language: data.language || 'en',
                timezone: data.timezone || 'America/New_York',
                dateFormat: data.date_format || 'MM/DD/YYYY',
                theme: data.theme || 'system',
                notifications: {
                    email: data.notification_email || DEFAULT_NOTIFICATION_PREFERENCES.email,
                    inApp: data.notification_inapp || DEFAULT_NOTIFICATION_PREFERENCES.inApp
                }
            };
        } catch (error) {
            console.error('[PreferencesService] getPreferences error:', error);
            return null;
        }
    },

    /**
     * Update current user's preferences
     */
    async updatePreferences(updates: PreferencesUpdateRequest): Promise<UserPreferences | null> {
        try {
            const user = await authService.getUser();
            if (!user) throw new Error('Not authenticated');

            const updateData: Record<string, any> = {};
            if (updates.language !== undefined) updateData.language = updates.language;
            if (updates.timezone !== undefined) updateData.timezone = updates.timezone;
            if (updates.dateFormat !== undefined) updateData.date_format = updates.dateFormat;
            if (updates.theme !== undefined) updateData.theme = updates.theme;
            if (updates.notifications?.email !== undefined) {
                updateData.notification_email = updates.notifications.email;
            }
            if (updates.notifications?.inApp !== undefined) {
                updateData.notification_inapp = updates.notifications.inApp;
            }

            // Upsert preferences
            const { error } = await supabase
                .from('user_preferences')
                .upsert({
                    user_id: user.id,
                    ...updateData,
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'user_id'
                });

            if (error) {
                console.error('[PreferencesService] Error updating preferences:', error);
                throw error;
            }

            return this.getPreferences();
        } catch (error) {
            console.error('[PreferencesService] updatePreferences error:', error);
            throw error;
        }
    }
};

// ============================================
// SESSION SERVICE
// ============================================

export const sessionService = {
    /**
     * Get current user's active sessions
     */
    async getSessions(): Promise<UserSession[]> {
        try {
            const user = await authService.getUser();
            if (!user) return [];

            const { data, error } = await supabase
                .from('user_sessions')
                .select('*')
                .eq('user_id', user.id)
                .eq('is_revoked', false)
                .order('last_activity_at', { ascending: false });

            if (error) {
                console.error('[SessionService] Error fetching sessions:', error);
                return [];
            }

            // Get current session to mark it
            const session = await authService.getSession();
            const currentJti = session?.access_token ? this.extractJti(session.access_token) : null;

            return (data || []).map(s => ({
                id: s.id,
                userId: s.user_id,
                deviceInfo: s.device_info || 'Unknown Device',
                browser: s.browser || 'Unknown Browser',
                os: s.os || 'Unknown OS',
                ipAddress: s.ip_address || 'Unknown',
                location: s.location,
                lastActivityAt: s.last_activity_at,
                createdAt: s.created_at,
                isCurrent: currentJti ? s.token_jti === currentJti : false
            }));
        } catch (error) {
            console.error('[SessionService] getSessions error:', error);
            return [];
        }
    },

    /**
     * Extract JTI from JWT token
     */
    extractJti(token: string): string | null {
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            return payload.jti || null;
        } catch {
            return null;
        }
    },

    /**
     * Revoke a specific session
     */
    async revokeSession(sessionId: string): Promise<boolean> {
        try {
            const user = await authService.getUser();
            if (!user) throw new Error('Not authenticated');

            const { error } = await supabase
                .from('user_sessions')
                .update({ is_revoked: true })
                .eq('id', sessionId)
                .eq('user_id', user.id);  // Security: only own sessions

            if (error) {
                console.error('[SessionService] Error revoking session:', error);
                throw error;
            }

            return true;
        } catch (error) {
            console.error('[SessionService] revokeSession error:', error);
            return false;
        }
    },

    /**
     * Revoke all sessions except current
     */
    async revokeOtherSessions(): Promise<number> {
        try {
            const user = await authService.getUser();
            if (!user) throw new Error('Not authenticated');

            const session = await authService.getSession();
            const currentJti = session?.access_token ? this.extractJti(session.access_token) : null;

            const { data, error } = await supabase
                .from('user_sessions')
                .update({ is_revoked: true })
                .eq('user_id', user.id)
                .eq('is_revoked', false)
                .neq('token_jti', currentJti || '')
                .select();

            if (error) {
                console.error('[SessionService] Error revoking sessions:', error);
                throw error;
            }

            return data?.length || 0;
        } catch (error) {
            console.error('[SessionService] revokeOtherSessions error:', error);
            return 0;
        }
    }
};

// ============================================
// SECURITY SERVICE
// ============================================

export const securityService = {
    /**
     * Change user's password
     */
    async changePassword(request: ChangePasswordRequest): Promise<ChangePasswordResponse> {
        try {
            // Validate passwords match
            if (request.newPassword !== request.confirmPassword) {
                return { success: false, message: 'Passwords do not match' };
            }

            // Validate password strength
            const validation = validatePassword(request.newPassword);
            if (!validation.valid) {
                return { success: false, message: validation.errors[0] };
            }

            // Verify current password by attempting sign in
            const user = await authService.getUser();
            if (!user?.email) {
                return { success: false, message: 'Not authenticated' };
            }

            try {
                await authService.signIn(user.email, request.currentPassword);
            } catch {
                return { success: false, message: 'Current password is incorrect' };
            }

            // Update password
            await authService.updatePassword(request.newPassword);

            // Revoke other sessions for security
            const revokedCount = await sessionService.revokeOtherSessions();

            return {
                success: true,
                message: 'Password changed successfully',
                sessionsRevoked: revokedCount
            };
        } catch (error: any) {
            console.error('[SecurityService] changePassword error:', error);
            return {
                success: false,
                message: error.message || 'Failed to change password'
            };
        }
    },

    /**
     * Send password reset email
     */
    async sendPasswordReset(email: string): Promise<boolean> {
        try {
            await authService.resetPassword(email);
            return true;
        } catch (error) {
            console.error('[SecurityService] sendPasswordReset error:', error);
            return false;
        }
    },

    /**
     * Logout current session and clear all local data
     */
    async logout(): Promise<void> {
        try {
            await authService.signOut();
        } catch (error) {
            console.error('[SecurityService] logout error:', error);
        } finally {
            // Always clear local storage
            localStorage.clear();
            // Clear cookies
            document.cookie.split(";").forEach(c => {
                document.cookie = c.replace(/^ +/, "")
                    .replace(/=.*/, `=;expires=${new Date().toUTCString()};path=/`);
            });
        }
    },

    /**
     * Logout all sessions
     */
    async logoutAll(): Promise<number> {
        try {
            const user = await authService.getUser();
            if (!user) return 0;

            // Revoke all sessions in DB
            const { data, error } = await supabase
                .from('user_sessions')
                .update({ is_revoked: true })
                .eq('user_id', user.id)
                .eq('is_revoked', false)
                .select();

            if (error) {
                console.error('[SecurityService] Error revoking all sessions:', error);
            }

            const count = data?.length || 0;

            // Logout current session
            await this.logout();

            return count;
        } catch (error) {
            console.error('[SecurityService] logoutAll error:', error);
            return 0;
        }
    }
};

// ============================================
// TEAM SERVICE (Admin only)
// ============================================

export const teamService = {
    /**
     * Get all team members
     */
    async getTeamMembers(): Promise<TeamMember[]> {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('[TeamService] Error fetching team:', error);
                return [];
            }

            return (data || []).map(u => ({
                id: u.id,
                email: u.email,
                firstName: u.first_name || u.name?.split(' ')[0] || '',
                lastName: u.last_name || u.name?.split(' ').slice(1).join(' ') || '',
                phone: u.phone,
                avatarUrl: u.avatar_url,
                role: (u.role?.toLowerCase() as UserRole) || 'lineman',
                organizationId: u.organization_id,
                organizationName: u.company_name,
                isActive: u.is_active !== false,
                createdAt: u.created_at,
                lastLoginAt: u.last_login_at
            }));
        } catch (error) {
            console.error('[TeamService] getTeamMembers error:', error);
            return [];
        }
    },

    /**
     * Invite a new user
     */
    async inviteUser(request: InviteUserRequest): Promise<InviteUserResponse> {
        try {
            // Generate a temporary password
            const tempPassword = Math.random().toString(36).slice(-12) + 'A1!';

            // Create user via Supabase Auth
            const { data, error } = await supabase.auth.admin.createUser({
                email: request.email,
                password: tempPassword,
                email_confirm: true,
                user_metadata: {
                    name: `${request.firstName} ${request.lastName}`,
                    role: request.role.toUpperCase()
                }
            });

            if (error) {
                // Fallback: Just create profile entry
                const { data: profileData, error: profileError } = await supabase
                    .from('profiles')
                    .insert({
                        email: request.email,
                        name: `${request.firstName} ${request.lastName}`,
                        first_name: request.firstName,
                        last_name: request.lastName,
                        role: request.role.toUpperCase(),
                        is_active: true
                    })
                    .select()
                    .single();

                if (profileError) {
                    return { success: false, message: profileError.message };
                }

                return {
                    success: true,
                    message: 'User profile created. They can register with this email.',
                    userId: profileData?.id
                };
            }

            return {
                success: true,
                message: 'User invited successfully',
                userId: data.user?.id
            };
        } catch (error: any) {
            console.error('[TeamService] inviteUser error:', error);
            return { success: false, message: error.message || 'Failed to invite user' };
        }
    },

    /**
     * Update user role
     */
    async updateUserRole(request: UpdateUserRoleRequest): Promise<boolean> {
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ role: request.role.toUpperCase() })
                .eq('id', request.userId);

            if (error) {
                console.error('[TeamService] Error updating role:', error);
                throw error;
            }

            return true;
        } catch (error) {
            console.error('[TeamService] updateUserRole error:', error);
            return false;
        }
    },

    /**
     * Deactivate user
     */
    async deactivateUser(userId: string): Promise<boolean> {
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ is_active: false })
                .eq('id', userId);

            if (error) throw error;
            return true;
        } catch (error) {
            console.error('[TeamService] deactivateUser error:', error);
            return false;
        }
    },

    /**
     * Reactivate user
     */
    async reactivateUser(userId: string): Promise<boolean> {
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ is_active: true })
                .eq('id', userId);

            if (error) throw error;
            return true;
        } catch (error) {
            console.error('[TeamService] reactivateUser error:', error);
            return false;
        }
    },

    /**
     * Send password reset to user
     */
    async sendUserPasswordReset(email: string): Promise<boolean> {
        return securityService.sendPasswordReset(email);
    }
};

// ============================================
// AUDIT SERVICE
// ============================================

export const auditService = {
    /**
     * Get audit log with filters and pagination
     */
    async getAuditLog(
        filters: AuditLogFilters = {},
        page: number = 1,
        pageSize: number = 20
    ): Promise<AuditLogResponse> {
        try {
            let query = supabase
                .from('audit_log')
                .select('*', { count: 'exact' });

            // Apply filters
            if (filters.startDate) {
                query = query.gte('created_at', filters.startDate);
            }
            if (filters.endDate) {
                query = query.lte('created_at', filters.endDate);
            }
            if (filters.action) {
                query = query.eq('action', filters.action);
            }
            if (filters.userId) {
                query = query.eq('user_id', filters.userId);
            }
            if (filters.entityType) {
                query = query.eq('entity_type', filters.entityType);
            }
            if (filters.isSuccess !== undefined) {
                query = query.eq('is_success', filters.isSuccess);
            }

            // Pagination
            const from = (page - 1) * pageSize;
            const to = from + pageSize - 1;

            const { data, error, count } = await query
                .order('created_at', { ascending: false })
                .range(from, to);

            if (error) {
                console.error('[AuditService] Error fetching audit log:', error);
                return { events: [], total: 0, page, pageSize, hasMore: false };
            }

            const events: AuditEvent[] = (data || []).map(e => ({
                id: e.id,
                action: e.action,
                entityType: e.entity_type,
                entityId: e.entity_id,
                userId: e.user_id,
                userEmail: e.user_email || '',
                userRole: e.user_role || '',
                ipAddress: e.ip_address,
                oldValues: e.old_values,
                newValues: e.new_values,
                metadata: e.metadata,
                isSuccess: e.is_success !== false,
                errorMessage: e.error_message,
                createdAt: e.created_at
            }));

            const total = count || 0;

            return {
                events,
                total,
                page,
                pageSize,
                hasMore: from + events.length < total
            };
        } catch (error) {
            console.error('[AuditService] getAuditLog error:', error);
            return { events: [], total: 0, page, pageSize, hasMore: false };
        }
    }
};

// ============================================
// ORGANIZATION SERVICE
// ============================================

export const organizationService = {
    /**
     * Get organization details
     */
    async getOrganization(): Promise<Organization | null> {
        try {
            // For now, get from current user's profile
            const profile = await profileService.getProfile();
            if (!profile) return null;

            // If we had an organizations table, we'd query it here
            // For now, construct from profile data
            return {
                id: profile.organizationId || profile.id,
                name: profile.organizationName || 'NextGen Fiber',
                createdAt: profile.createdAt,
                updatedAt: profile.createdAt
            };
        } catch (error) {
            console.error('[OrganizationService] getOrganization error:', error);
            return null;
        }
    },

    /**
     * Update organization details
     */
    async updateOrganization(updates: OrganizationUpdateRequest): Promise<Organization | null> {
        try {
            const user = await authService.getUser();
            if (!user) throw new Error('Not authenticated');

            // Update company_name in profiles for now
            if (updates.name) {
                await supabase
                    .from('profiles')
                    .update({ company_name: updates.name })
                    .eq('id', user.id);
            }

            return this.getOrganization();
        } catch (error) {
            console.error('[OrganizationService] updateOrganization error:', error);
            return null;
        }
    }
};

// Export combined service
export const settingsService = {
    profile: profileService,
    preferences: preferencesService,
    sessions: sessionService,
    security: securityService,
    team: teamService,
    audit: auditService,
    organization: organizationService,
    // Utility functions
    getPasswordStrength,
    validatePassword
};

export default settingsService;
