import React, { useState, useEffect } from 'react';
import { User as UserIcon, Mail, ArrowRight, Cpu, Zap, CheckCircle2, HardHat, Shield, Lock, Building2, UserPlus, LogIn, RefreshCw, AlertCircle } from 'lucide-react';
import Logo from './Logo';
import { User, Language } from '../types';
import { translations } from '../services/translations';
import { authService, supabase } from '../services/supabase';

interface AuthPageProps {
    onLogin: (user: User) => void;
    lang: Language;
}

type UserRole = 'LINEMAN' | 'ADMIN';
type AuthMode = 'login' | 'register' | 'forgot_password';
type AuthStatus = 'idle' | 'loading' | 'check_email' | 'reset_sent' | 'error';

const AuthPage: React.FC<AuthPageProps> = ({ onLogin, lang }) => {
    const t = translations[lang];
    const [authMode, setAuthMode] = useState<AuthMode>('login');
    const [authStatus, setAuthStatus] = useState<AuthStatus>('idle');
    const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [companyName, setCompanyName] = useState('');
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    // Check for existing session on mount
    useEffect(() => {
        checkExistingSession();
    }, []);

    const checkExistingSession = async () => {
        try {
            const session = await authService.getSession();
            if (session?.user) {
                const userData = session.user.user_metadata;
                onLogin({
                    id: session.user.id,
                    email: session.user.email || '',
                    name: userData?.name || 'User',
                    role: userData?.role || 'LINEMAN',
                    companyName: userData?.companyName || 'NextGen Fiber',
                });
            }
        } catch (err) {
            console.log('No existing session');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (authStatus === 'loading' || !selectedRole) return;

        setError('');
        setSuccessMessage('');

        // Validation
        if (authMode === 'register') {
            if (!name.trim()) {
                setError('Name is required');
                return;
            }
            if (!password || password.length < 6) {
                setError('Password must be at least 6 characters');
                return;
            }
            if (password !== confirmPassword) {
                setError('Passwords do not match');
                return;
            }
        }

        if (!email.trim()) {
            setError('Email is required');
            return;
        }

        setAuthStatus('loading');

        try {
            if (authMode === 'register') {
                // Register new user
                const result = await authService.signUp(email, password, {
                    name,
                    role: selectedRole,
                    companyName: companyName || 'NextGen Fiber'
                });

                if (result.user) {
                    // Try to create profile record in Supabase
                    try {
                        await supabase.from('profiles').upsert({
                            id: result.user.id,
                            email: result.user.email,
                            name,
                            role: selectedRole,
                            company_name: companyName || 'NextGen Fiber',
                            created_at: new Date().toISOString(),
                            updated_at: new Date().toISOString()
                        });
                    } catch (profileError) {
                        console.log('Profile table may not exist yet:', profileError);
                    }
                }

                if (result.user && !result.user.email_confirmed_at) {
                    // Email confirmation required
                    setAuthStatus('check_email');
                    setSuccessMessage(`Confirmation email sent to ${email}. Please check your inbox and click the link to activate your account.`);
                } else if (result.user) {
                    // Already confirmed (shouldn't happen on fresh signup)
                    onLogin({
                        id: result.user.id,
                        email: result.user.email || '',
                        name,
                        role: selectedRole,
                        companyName: companyName || 'NextGen Fiber',
                    });
                }
            } else {
                // Login existing user
                const result = await authService.signIn(email, password);

                if (result.user) {
                    const userData = result.user.user_metadata;
                    onLogin({
                        id: result.user.id,
                        email: result.user.email || '',
                        name: userData?.name || name || 'User',
                        role: userData?.role || selectedRole || 'LINEMAN',
                        companyName: userData?.companyName || 'NextGen Fiber',
                    });
                }
            }
        } catch (err: any) {
            setAuthStatus('error');

            // Handle specific error messages
            if (err.message?.includes('Invalid login credentials')) {
                setError('Invalid email or password. Please check your credentials.');
            } else if (err.message?.includes('Email not confirmed')) {
                setError('Please confirm your email before logging in. Check your inbox for the confirmation link.');
            } else if (err.message?.includes('User already registered')) {
                setError('This email is already registered. Please login instead.');
            } else if (err.message?.includes('rate limit')) {
                setError('Too many attempts. Please wait a few minutes and try again.');
            } else {
                setError(err.message || 'An error occurred. Please try again.');
            }
        }
    };

    const handleResendConfirmation = async () => {
        if (!email) return;

        setAuthStatus('loading');
        try {
            await authService.resendConfirmation(email);
            setSuccessMessage('Confirmation email resent! Please check your inbox.');
            setAuthStatus('check_email');
        } catch (err: any) {
            setError(err.message || 'Failed to resend confirmation email.');
            setAuthStatus('error');
        }
    };

    const handleRoleSelect = (role: UserRole) => {
        setSelectedRole(role);
        setError('');
    };

    const switchAuthMode = (mode: AuthMode) => {
        setAuthMode(mode);
        setAuthStatus('idle');
        setError('');
        setSuccessMessage('');
        setPassword('');
        setConfirmPassword('');
    };

    const handleForgotPassword = async () => {
        console.log('[AUTH] Forgot password clicked, email:', email);

        if (!email.trim()) {
            setError('Please enter your email address first');
            return;
        }

        setAuthStatus('loading');
        setError('');
        setSuccessMessage('');

        try {
            console.log('[AUTH] Sending reset email to:', email);
            await authService.resetPassword(email);
            console.log('[AUTH] Reset email sent successfully');
            setAuthStatus('reset_sent');
            setSuccessMessage(`Password reset email sent to ${email}. Check your inbox.`);
        } catch (err: any) {
            console.error('[AUTH] Reset password error:', err);
            setError(err.message || 'Failed to send reset email. Make sure the email is registered.');
            setAuthStatus('idle');
        }
    };

    const handleOAuthLogin = async (provider: 'google' | 'apple') => {
        setAuthStatus('loading');
        setError('');

        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider,
                options: {
                    redirectTo: window.location.origin
                }
            });

            if (error) throw error;
        } catch (err: any) {
            setError(err.message || `Failed to login with ${provider}`);
            setAuthStatus('error');
        }
    };

    // Check Email Confirmation Screen
    if (authStatus === 'check_email') {
        return (
            <div className="min-h-screen flex items-center justify-center p-4 lg:p-8 relative overflow-hidden font-sans" style={{ background: 'var(--abyss)' }}>
                <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full blur-[180px] animate-pulse" style={{ background: 'var(--neural-pulse)' }}></div>
                <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full blur-[180px]" style={{ background: 'var(--energy-pulse)' }}></div>

                <div className="w-full max-w-md p-8 glass-strong rounded-3xl text-center space-y-6" style={{ boxShadow: 'var(--shadow-glow)' }}>
                    <div className="w-20 h-20 mx-auto rounded-full flex items-center justify-center" style={{ background: 'var(--neural-dim)', border: '2px solid var(--neural-core)' }}>
                        <Mail className="w-10 h-10" style={{ color: 'var(--neural-core)' }} />
                    </div>

                    <h2 className="text-2xl font-black uppercase" style={{ color: 'var(--text-primary)' }}>
                        Check Your Email
                    </h2>

                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {successMessage}
                    </p>

                    <div className="p-4 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}>
                        <p className="text-xs font-bold" style={{ color: 'var(--text-tertiary)' }}>
                            Sent to: <span style={{ color: 'var(--neural-core)' }}>{email}</span>
                        </p>
                    </div>

                    <div className="space-y-3 pt-4">
                        <button
                            onClick={handleResendConfirmation}
                            disabled={false}
                            className="w-full py-3 rounded-xl text-xs font-bold uppercase flex items-center justify-center gap-2 transition-all hover:scale-[1.02]"
                            style={{ background: 'var(--surface)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }}
                        >
                            <RefreshCw className="w-4 h-4" />
                            Resend Confirmation Email
                        </button>

                        <button
                            onClick={() => {
                                setAuthStatus('idle');
                                setAuthMode('login');
                            }}
                            className="w-full py-3 rounded-xl text-xs font-bold uppercase flex items-center justify-center gap-2 transition-all hover:scale-[1.02]"
                            style={{ background: 'var(--neural-dim)', color: 'var(--neural-core)', border: '1px solid var(--border-neural)' }}
                        >
                            <LogIn className="w-4 h-4" />
                            Back to Login
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Password Reset Sent Screen
    if (authStatus === 'reset_sent') {
        return (
            <div className="min-h-screen flex items-center justify-center p-4 lg:p-8 relative overflow-hidden font-sans" style={{ background: 'var(--abyss)' }}>
                <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full blur-[180px] animate-pulse" style={{ background: 'var(--neural-pulse)' }}></div>
                <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full blur-[180px]" style={{ background: 'var(--energy-pulse)' }}></div>

                <div className="w-full max-w-md p-8 glass-strong rounded-3xl text-center space-y-6" style={{ boxShadow: 'var(--shadow-glow)' }}>
                    <div className="w-20 h-20 mx-auto rounded-full flex items-center justify-center" style={{ background: 'var(--neural-dim)', border: '2px solid var(--neural-core)' }}>
                        <Mail className="w-10 h-10" style={{ color: 'var(--neural-core)' }} />
                    </div>

                    <h2 className="text-2xl font-black uppercase" style={{ color: 'var(--text-primary)' }}>
                        Check Your Email
                    </h2>

                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                        We sent a password reset link to your email. Click the link to reset your password.
                    </p>

                    <div className="p-4 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}>
                        <p className="text-xs font-bold" style={{ color: 'var(--text-tertiary)' }}>
                            Sent to: <span style={{ color: 'var(--neural-core)' }}>{email}</span>
                        </p>
                    </div>

                    <div className="space-y-3 pt-4">
                        <button
                            onClick={handleForgotPassword}
                            className="w-full py-3 rounded-xl text-xs font-bold uppercase flex items-center justify-center gap-2 transition-all hover:scale-[1.02]"
                            style={{ background: 'var(--surface)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }}
                        >
                            <RefreshCw className="w-4 h-4" />
                            Resend Reset Email
                        </button>

                        <button
                            onClick={() => {
                                setAuthStatus('idle');
                                setAuthMode('login');
                            }}
                            className="w-full py-3 rounded-xl text-xs font-bold uppercase flex items-center justify-center gap-2 transition-all hover:scale-[1.02]"
                            style={{ background: 'var(--neural-dim)', color: 'var(--neural-core)', border: '1px solid var(--border-neural)' }}
                        >
                            <LogIn className="w-4 h-4" />
                            Back to Login
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4 lg:p-8 relative overflow-hidden font-sans" style={{ background: 'var(--abyss)' }}>
            {/* Neural Background Effects */}
            <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full blur-[180px] animate-pulse" style={{ background: 'var(--neural-pulse)' }}></div>
            <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full blur-[180px]" style={{ background: 'var(--energy-pulse)' }}></div>

            {/* Grid Background */}
            <div className="absolute inset-0 grid-bg opacity-30"></div>

            {/* Scan Line Effect */}
            <div className="absolute inset-0 scan-line pointer-events-none"></div>

            <div className="w-full max-w-[1200px] min-h-[500px] lg:min-h-[700px] grid grid-cols-1 lg:grid-cols-2 glass-strong rounded-[1.5rem] lg:rounded-[3rem] shadow-2xl overflow-hidden relative z-10 animate-scale-in" style={{ boxShadow: 'var(--shadow-glow)' }}>

                {/* Brand Side */}
                <div className="hidden lg:flex flex-col justify-between p-12 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.03) 0%, rgba(168, 85, 247, 0.03) 100%)', borderRight: '1px solid var(--border-subtle)' }}>
                    {/* Decorative Circuit Lines */}
                    <div className="absolute top-0 left-0 w-full h-full opacity-10">
                        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                            <defs>
                                <linearGradient id="circuitGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" stopColor="#00d4ff" />
                                    <stop offset="100%" stopColor="#a855f7" />
                                </linearGradient>
                            </defs>
                            <path d="M0 100 L100 100 L100 200 L200 200" stroke="url(#circuitGrad)" strokeWidth="1" fill="none" opacity="0.5"/>
                            <path d="M0 300 L150 300 L150 400 L300 400" stroke="url(#circuitGrad)" strokeWidth="1" fill="none" opacity="0.3"/>
                            <circle cx="100" cy="100" r="3" fill="#00d4ff" opacity="0.5"/>
                            <circle cx="200" cy="200" r="3" fill="#a855f7" opacity="0.5"/>
                        </svg>
                    </div>

                    <div className="relative z-10">
                        <Logo className="w-12 h-12" showText={true} />
                    </div>

                    <div className="flex flex-col justify-center space-y-12 relative z-10">
                        <div className="space-y-6">
                            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full w-fit" style={{ background: 'var(--neural-dim)', border: '1px solid var(--border-neural)' }}>
                                <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--neural-core)' }}></span>
                                <span className="font-bold text-[10px] tracking-widest uppercase" style={{ color: 'var(--neural-core)' }}>The First AI for Fiber</span>
                            </div>

                            <h2 className="text-5xl xl:text-6xl font-black tracking-tighter leading-[1.05]" style={{ color: 'var(--text-primary)' }}>
                                Neural Control<br/>for <span className="text-gradient-neural">Fiber</span> Networks
                            </h2>

                            <p className="text-lg font-medium leading-relaxed max-w-md pl-6" style={{ color: 'var(--text-secondary)', borderLeft: '2px solid var(--border-neural)' }}>
                                Enterprise AI platform for asset management, automated auditing, and transparency in fiber optic construction.
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-4 max-w-md mt-4">
                            {[
                                { icon: Cpu, label: 'Neural Core', desc: 'AI Processing', color: 'var(--neural-core)', bg: 'var(--neural-dim)', border: 'var(--border-neural)' },
                                { icon: Zap, label: 'Real-time', desc: 'Live Analysis', color: 'var(--energy-core)', bg: 'var(--energy-pulse)', border: 'rgba(168, 85, 247, 0.3)' }
                            ].map((item, i) => (
                                <div key={i} className="flex items-start gap-4 p-5 rounded-2xl backdrop-blur-sm transition-all duration-300 hover:scale-[1.02] cursor-default neural-border" style={{ background: item.bg, border: `1px solid ${item.border}` }}>
                                    <item.icon className="w-6 h-6 shrink-0" style={{ color: item.color }} />
                                    <div>
                                        <p className="text-xs font-black uppercase tracking-wider" style={{ color: 'var(--text-primary)' }}>{item.label}</p>
                                        <p className="text-[10px] font-bold uppercase tracking-widest mt-1" style={{ color: 'var(--text-tertiary)' }}>{item.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center gap-3 relative z-10">
                        <div className="status-online"></div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: 'var(--text-ghost)' }}>
                            Powered by Claude AI & Gemini
                        </p>
                    </div>
                </div>

                {/* Form Side */}
                <div className="flex flex-col justify-center p-4 sm:p-8 lg:p-16 relative" style={{ background: 'var(--void)' }}>
                    {/* Subtle gradient overlay */}
                    <div className="absolute inset-0 opacity-50" style={{ background: 'radial-gradient(circle at center, var(--neural-dim) 0%, transparent 70%)' }}></div>

                    <div className="w-full max-w-md mx-auto space-y-6 relative z-10">

                        {/* Logo Mobile */}
                        <div className="lg:hidden flex justify-center mb-8">
                            <Logo className="w-14 h-14" showText={true} />
                        </div>

                        {/* Auth Mode Tabs */}
                        <div className="flex gap-2 p-1 rounded-2xl" style={{ background: 'var(--surface)' }}>
                            <button
                                type="button"
                                onClick={() => switchAuthMode('login')}
                                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                                    authMode === 'login' ? '' : 'opacity-60 hover:opacity-100'
                                }`}
                                style={{
                                    background: authMode === 'login' ? 'var(--neural-dim)' : 'transparent',
                                    color: authMode === 'login' ? 'var(--neural-core)' : 'var(--text-secondary)',
                                    border: authMode === 'login' ? '1px solid var(--border-neural)' : '1px solid transparent'
                                }}
                            >
                                <LogIn className="w-4 h-4" />
                                Login
                            </button>
                            <button
                                type="button"
                                onClick={() => switchAuthMode('register')}
                                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                                    authMode === 'register' ? '' : 'opacity-60 hover:opacity-100'
                                }`}
                                style={{
                                    background: authMode === 'register' ? 'var(--energy-pulse)' : 'transparent',
                                    color: authMode === 'register' ? 'var(--energy-core)' : 'var(--text-secondary)',
                                    border: authMode === 'register' ? '1px solid rgba(168, 85, 247, 0.3)' : '1px solid transparent'
                                }}
                            >
                                <UserPlus className="w-4 h-4" />
                                Create Account
                            </button>
                        </div>

                        <div className="text-center space-y-2 sm:space-y-3">
                            <h3 className="text-2xl sm:text-3xl font-black uppercase tracking-tight" style={{ color: 'var(--text-primary)' }}>
                                {authMode === 'login' ? 'Access Portal' : 'Create Account'}
                            </h3>
                            <p className="text-xs sm:text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                                {authMode === 'login' ? 'Select your access type to continue' : 'Register as a new user'}
                            </p>
                        </div>

                        {/* Role Selection Cards */}
                        <div className="grid grid-cols-2 gap-2 sm:gap-4">
                            {/* Lineman Card */}
                            <button
                                type="button"
                                onClick={() => handleRoleSelect('LINEMAN')}
                                className={`relative p-3 sm:p-6 rounded-2xl sm:rounded-3xl border-2 transition-all duration-300 group ${
                                    selectedRole === 'LINEMAN'
                                        ? 'animate-glow-pulse'
                                        : 'hover:scale-[1.02]'
                                }`}
                                style={{
                                    background: selectedRole === 'LINEMAN' ? 'var(--neural-dim)' : 'var(--surface)',
                                    borderColor: selectedRole === 'LINEMAN' ? 'var(--neural-core)' : 'var(--border-default)',
                                    boxShadow: selectedRole === 'LINEMAN' ? 'var(--shadow-neural)' : 'none'
                                }}
                            >
                                <div className="flex flex-col items-center gap-2 sm:gap-4">
                                    <div className="p-2 sm:p-4 rounded-xl sm:rounded-2xl transition-all" style={{
                                        background: selectedRole === 'LINEMAN' ? 'var(--neural-glow)' : 'var(--elevated)'
                                    }}>
                                        <HardHat className="w-6 h-6 sm:w-10 sm:h-10 transition-colors" style={{
                                            color: selectedRole === 'LINEMAN' ? 'var(--neural-core)' : 'var(--energy-core)'
                                        }} />
                                    </div>
                                    <div className="text-center">
                                        <p className="text-sm sm:text-lg font-black uppercase tracking-tight transition-colors" style={{
                                            color: selectedRole === 'LINEMAN' ? 'var(--neural-core)' : 'var(--text-primary)'
                                        }}>
                                            Lineman
                                        </p>
                                        <p className="text-[8px] sm:text-[10px] font-bold uppercase tracking-wider mt-1" style={{ color: 'var(--text-ghost)' }}>
                                            Field Technician
                                        </p>
                                    </div>
                                </div>
                                {selectedRole === 'LINEMAN' && (
                                    <div className="absolute top-3 right-3">
                                        <CheckCircle2 className="w-5 h-5" style={{ color: 'var(--neural-core)' }} />
                                    </div>
                                )}
                            </button>

                            {/* Admin Card */}
                            <button
                                type="button"
                                onClick={() => handleRoleSelect('ADMIN')}
                                className={`relative p-3 sm:p-6 rounded-2xl sm:rounded-3xl border-2 transition-all duration-300 group ${
                                    selectedRole === 'ADMIN'
                                        ? ''
                                        : 'hover:scale-[1.02]'
                                }`}
                                style={{
                                    background: selectedRole === 'ADMIN' ? 'var(--energy-pulse)' : 'var(--surface)',
                                    borderColor: selectedRole === 'ADMIN' ? 'var(--energy-core)' : 'var(--border-default)',
                                    boxShadow: selectedRole === 'ADMIN' ? 'var(--shadow-energy)' : 'none'
                                }}
                            >
                                <div className="flex flex-col items-center gap-2 sm:gap-4">
                                    <div className="p-2 sm:p-4 rounded-xl sm:rounded-2xl transition-all" style={{
                                        background: selectedRole === 'ADMIN' ? 'var(--energy-glow)' : 'var(--elevated)'
                                    }}>
                                        <Shield className="w-6 h-6 sm:w-10 sm:h-10 transition-colors" style={{
                                            color: selectedRole === 'ADMIN' ? 'var(--energy-core)' : 'var(--energy-core)'
                                        }} />
                                    </div>
                                    <div className="text-center">
                                        <p className="text-sm sm:text-lg font-black uppercase tracking-tight transition-colors" style={{
                                            color: selectedRole === 'ADMIN' ? 'var(--energy-core)' : 'var(--text-primary)'
                                        }}>
                                            Admin
                                        </p>
                                        <p className="text-[8px] sm:text-[10px] font-bold uppercase tracking-wider mt-1" style={{ color: 'var(--text-ghost)' }}>
                                            Full Access
                                        </p>
                                    </div>
                                </div>
                                {selectedRole === 'ADMIN' && (
                                    <div className="absolute top-3 right-3">
                                        <CheckCircle2 className="w-5 h-5" style={{ color: 'var(--energy-core)' }} />
                                    </div>
                                )}
                            </button>
                        </div>

                        {/* Auth Form - Appears after role selection */}
                        {selectedRole && (
                            <form onSubmit={handleSubmit} className="space-y-4 animate-fade-in-up">
                                {/* Error Message */}
                                {error && (
                                    <div className="p-3 rounded-xl text-xs font-bold flex items-start gap-2" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                        {error}
                                    </div>
                                )}

                                {/* Name Field - Required for register, optional for login */}
                                {authMode === 'register' && (
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase ml-2" style={{ color: 'var(--text-tertiary)' }}>Name *</label>
                                        <div className="input-neural p-1.5 flex items-center group" style={{
                                            borderColor: selectedRole === 'LINEMAN' ? 'var(--border-neural)' : 'rgba(168, 85, 247, 0.3)'
                                        }}>
                                            <div className="p-3 rounded-xl transition-colors" style={{ background: 'var(--elevated)' }}>
                                                <UserIcon className="w-4 h-4" style={{ color: selectedRole === 'LINEMAN' ? 'var(--neural-core)' : 'var(--energy-core)' }} />
                                            </div>
                                            <input
                                                type="text"
                                                value={name}
                                                onChange={e => setName(e.target.value)}
                                                className="bg-transparent w-full p-2 text-sm font-bold outline-none"
                                                style={{ color: 'var(--text-primary)' }}
                                                placeholder={selectedRole === 'ADMIN' ? 'Admin Name' : 'Lineman Name'}
                                                required
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Email Field */}
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase ml-2" style={{ color: 'var(--text-tertiary)' }}>Email *</label>
                                    <div className="input-neural p-1.5 flex items-center group" style={{
                                        borderColor: selectedRole === 'LINEMAN' ? 'var(--border-neural)' : 'rgba(168, 85, 247, 0.3)'
                                    }}>
                                        <div className="p-3 rounded-xl transition-colors" style={{ background: 'var(--elevated)' }}>
                                            <Mail className="w-4 h-4" style={{ color: selectedRole === 'LINEMAN' ? 'var(--neural-core)' : 'var(--energy-core)' }} />
                                        </div>
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={e => setEmail(e.target.value)}
                                            className="bg-transparent w-full p-2 text-sm font-bold outline-none"
                                            style={{ color: 'var(--text-primary)' }}
                                            placeholder="user@company.com"
                                            required
                                        />
                                    </div>
                                </div>

                                {/* Password Field */}
                                <div className="space-y-1.5">
                                    <div className="flex justify-between items-center">
                                        <label className="text-[10px] font-black uppercase ml-2" style={{ color: 'var(--text-tertiary)' }}>Password *</label>
                                        {authMode === 'login' && (
                                            <button
                                                type="button"
                                                onClick={handleForgotPassword}
                                                className="text-[10px] font-bold hover:underline"
                                                style={{ color: 'var(--neural-core)' }}
                                            >
                                                Forgot Password?
                                            </button>
                                        )}
                                    </div>
                                    <div className="input-neural p-1.5 flex items-center group" style={{
                                        borderColor: selectedRole === 'LINEMAN' ? 'var(--border-neural)' : 'rgba(168, 85, 247, 0.3)'
                                    }}>
                                        <div className="p-3 rounded-xl transition-colors" style={{ background: 'var(--elevated)' }}>
                                            <Lock className="w-4 h-4" style={{ color: selectedRole === 'LINEMAN' ? 'var(--neural-core)' : 'var(--energy-core)' }} />
                                        </div>
                                        <input
                                            type="password"
                                            value={password}
                                            onChange={e => setPassword(e.target.value)}
                                            className="bg-transparent w-full p-2 text-sm font-bold outline-none"
                                            style={{ color: 'var(--text-primary)' }}
                                            placeholder={authMode === 'register' ? 'Min. 6 characters' : 'Your password'}
                                            required
                                        />
                                    </div>
                                </div>

                                {/* Confirm Password - Only for Register */}
                                {authMode === 'register' && (
                                    <>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black uppercase ml-2" style={{ color: 'var(--text-tertiary)' }}>Confirm Password *</label>
                                            <div className="input-neural p-1.5 flex items-center group" style={{
                                                borderColor: selectedRole === 'LINEMAN' ? 'var(--border-neural)' : 'rgba(168, 85, 247, 0.3)'
                                            }}>
                                                <div className="p-3 rounded-xl transition-colors" style={{ background: 'var(--elevated)' }}>
                                                    <Lock className="w-4 h-4" style={{ color: selectedRole === 'LINEMAN' ? 'var(--neural-core)' : 'var(--energy-core)' }} />
                                                </div>
                                                <input
                                                    type="password"
                                                    value={confirmPassword}
                                                    onChange={e => setConfirmPassword(e.target.value)}
                                                    className="bg-transparent w-full p-2 text-sm font-bold outline-none"
                                                    style={{ color: 'var(--text-primary)' }}
                                                    placeholder="Repeat password"
                                                    required
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black uppercase ml-2" style={{ color: 'var(--text-tertiary)' }}>Company Name</label>
                                            <div className="input-neural p-1.5 flex items-center group" style={{
                                                borderColor: selectedRole === 'LINEMAN' ? 'var(--border-neural)' : 'rgba(168, 85, 247, 0.3)'
                                            }}>
                                                <div className="p-3 rounded-xl transition-colors" style={{ background: 'var(--elevated)' }}>
                                                    <Building2 className="w-4 h-4" style={{ color: selectedRole === 'LINEMAN' ? 'var(--neural-core)' : 'var(--energy-core)' }} />
                                                </div>
                                                <input
                                                    type="text"
                                                    value={companyName}
                                                    onChange={e => setCompanyName(e.target.value)}
                                                    className="bg-transparent w-full p-2 text-sm font-bold outline-none"
                                                    style={{ color: 'var(--text-primary)' }}
                                                    placeholder="Your company name"
                                                />
                                            </div>
                                        </div>
                                    </>
                                )}

                                <button
                                    type="submit"
                                    disabled={authStatus === 'loading'}
                                    className="w-full py-3 sm:py-5 rounded-xl sm:rounded-2xl text-black font-black uppercase text-[10px] sm:text-xs tracking-widest hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 group mt-4 sm:mt-6 btn-neural"
                                    style={{
                                        background: selectedRole === 'LINEMAN' ? 'var(--gradient-neural)' : 'linear-gradient(135deg, #a855f7 0%, #00d4ff 100%)',
                                        boxShadow: selectedRole === 'LINEMAN' ? 'var(--shadow-neural)' : 'var(--shadow-energy)'
                                    }}
                                >
                                    {authStatus === 'loading' ? (
                                        <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                                    ) : (
                                        <>
                                            {authMode === 'login' ? `Login as ${selectedRole === 'LINEMAN' ? 'Lineman' : 'Administrator'}` : 'Create Account'}
                                            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                        </>
                                    )}
                                </button>

                                {/* OAuth Divider */}
                                {authMode === 'login' && (
                                    <>
                                        <div className="flex items-center gap-4 my-4">
                                            <div className="flex-1 h-px" style={{ background: 'var(--border-subtle)' }}></div>
                                            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-ghost)' }}>or continue with</span>
                                            <div className="flex-1 h-px" style={{ background: 'var(--border-subtle)' }}></div>
                                        </div>

                                        {/* OAuth Buttons */}
                                        <div className="grid grid-cols-2 gap-3">
                                            <button
                                                type="button"
                                                onClick={() => handleOAuthLogin('google')}
                                                className="flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all hover:scale-[1.02]"
                                                style={{ background: 'var(--surface)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                                            >
                                                <svg className="w-4 h-4" viewBox="0 0 24 24">
                                                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                                                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                                                </svg>
                                                Google
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleOAuthLogin('apple')}
                                                className="flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all hover:scale-[1.02]"
                                                style={{ background: 'var(--surface)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                                            >
                                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                                                </svg>
                                                Apple
                                            </button>
                                        </div>
                                    </>
                                )}

                            </form>
                        )}

                        {/* Access Info */}
                        {!selectedRole && (
                            <div className="space-y-3 pt-4">
                                <div className="flex items-start gap-3 p-4 rounded-2xl" style={{ background: 'var(--neural-dim)', border: '1px solid var(--border-neural)' }}>
                                    <HardHat className="w-5 h-5 shrink-0 mt-0.5" style={{ color: 'var(--neural-core)' }} />
                                    <div>
                                        <p className="text-xs font-bold uppercase" style={{ color: 'var(--neural-core)' }}>Lineman Access</p>
                                        <p className="text-[11px] mt-1" style={{ color: 'var(--text-secondary)' }}>Dashboard, Daily Production, Maps</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3 p-4 rounded-2xl" style={{ background: 'var(--energy-pulse)', border: '1px solid rgba(168, 85, 247, 0.3)' }}>
                                    <Shield className="w-5 h-5 shrink-0 mt-0.5" style={{ color: 'var(--energy-core)' }} />
                                    <div>
                                        <p className="text-xs font-bold uppercase" style={{ color: 'var(--energy-core)' }}>Administrator Access</p>
                                        <p className="text-[11px] mt-1" style={{ color: 'var(--text-secondary)' }}>Full access to all modules</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AuthPage;
