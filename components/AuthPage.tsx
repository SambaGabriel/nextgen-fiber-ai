import React, { useState, useEffect } from 'react';
import { User as UserIcon, Mail, ArrowRight, Cpu, Zap, CheckCircle2, HardHat, Shield, Lock, Building2, UserPlus, LogIn, RefreshCw, AlertCircle } from 'lucide-react';
import Logo from './Logo';
import { User, Language } from '../types';
import { translations } from '../services/translations';
import { authService } from '../services/supabase';

interface AuthPageProps {
    onLogin: (user: User) => void;
    lang: Language;
}

type UserRole = 'LINEMAN' | 'ADMIN';
type AuthMode = 'login' | 'register';
type AuthStatus = 'idle' | 'loading' | 'check_email' | 'error';

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
                            disabled={authStatus === 'loading'}
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
                                    <label className="text-[10px] font-black uppercase ml-2" style={{ color: 'var(--text-tertiary)' }}>Password *</label>
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
