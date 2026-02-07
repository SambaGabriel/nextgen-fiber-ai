/**
 * Supabase Client Configuration
 * Real authentication with email confirmation
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://fnukdvopmvwkghxzbkir.supabase.co';
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZudWtkdm9wbXZ3a2doeHpia2lyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzMzAwMTcsImV4cCI6MjA4NTkwNjAxN30.SLWQMyUv7rDT0kKLzq33jN1Mz4_L6jKrTtNTodJok5Q';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Auth helper functions
export const authService = {
  /**
   * Register a new user with email confirmation
   */
  async signUp(email: string, password: string, metadata: { name: string; role: string; companyName?: string }) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata,
        emailRedirectTo: `${window.location.origin}/auth/callback`
      }
    });

    if (error) throw error;
    return data;
  },

  /**
   * Sign in with email and password
   */
  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;
    return data;
  },

  /**
   * Sign out current user
   */
  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  /**
   * Get current session
   */
  async getSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
  },

  /**
   * Get current user
   */
  async getUser() {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    return data.user;
  },

  /**
   * Resend confirmation email
   */
  async resendConfirmation(email: string) {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email
    });
    if (error) throw error;
  },

  /**
   * Reset password
   */
  async resetPassword(email: string) {
    console.log('[SUPABASE] Sending password reset to:', email);
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin
    });
    console.log('[SUPABASE] Reset response:', { data, error });
    if (error) throw error;
    return data;
  },

  /**
   * Update password
   */
  async updatePassword(newPassword: string) {
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });
    if (error) throw error;
  },

  /**
   * Listen to auth state changes
   */
  onAuthStateChange(callback: (event: string, session: any) => void) {
    return supabase.auth.onAuthStateChange(callback);
  }
};

export default supabase;
