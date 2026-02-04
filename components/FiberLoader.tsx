import React from 'react';

interface FiberLoaderProps {
    size?: number;
    text?: string;
    showText?: boolean;
}

const FiberLoader: React.FC<FiberLoaderProps> = ({
    size = 60,
    text = "Loading...",
    showText = true
}) => {
    return (
        <div className="flex flex-col items-center justify-center gap-4">
            <div
                className="relative"
                style={{ width: size, height: size }}
            >
                {/* Outer ring */}
                <div
                    className="absolute inset-0 rounded-full animate-spin"
                    style={{
                        background: 'conic-gradient(from 0deg, transparent, var(--neural-core, #8b5cf6))',
                        animationDuration: '1.5s'
                    }}
                />
                {/* Inner circle */}
                <div
                    className="absolute rounded-full"
                    style={{
                        inset: '4px',
                        background: 'var(--bg-primary, #0a0a0f)'
                    }}
                />
                {/* Center glow */}
                <div
                    className="absolute rounded-full animate-pulse"
                    style={{
                        inset: size * 0.3,
                        background: 'radial-gradient(circle, var(--neural-core, #8b5cf6) 0%, transparent 70%)',
                        opacity: 0.6
                    }}
                />
                {/* Fiber lines */}
                <svg
                    className="absolute inset-0 w-full h-full animate-pulse"
                    viewBox="0 0 100 100"
                    style={{ animationDelay: '0.5s' }}
                >
                    <circle
                        cx="50" cy="50" r="35"
                        fill="none"
                        stroke="url(#fiberGradient)"
                        strokeWidth="2"
                        strokeDasharray="10 5"
                        className="animate-spin"
                        style={{ animationDuration: '3s', transformOrigin: 'center' }}
                    />
                    <defs>
                        <linearGradient id="fiberGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#06b6d4" />
                            <stop offset="50%" stopColor="#8b5cf6" />
                            <stop offset="100%" stopColor="#a855f7" />
                        </linearGradient>
                    </defs>
                </svg>
            </div>
            {showText && text && (
                <p
                    className="text-sm font-medium animate-pulse"
                    style={{ color: 'var(--text-secondary, #94a3b8)' }}
                >
                    {text}
                </p>
            )}
        </div>
    );
};

export default FiberLoader;
