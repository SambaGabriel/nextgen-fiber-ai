import React from 'react';

interface LogoProps {
    className?: string;
    showText?: boolean;
    animated?: boolean;
}

const Logo: React.FC<LogoProps> = ({ className = "w-8 h-8", showText = false, animated = true }) => {
    return (
        <div className="flex items-center gap-3 select-none">
            {/* Icon Container */}
            <div className={`relative flex items-center justify-center shrink-0 ${className}`}>
                {/* Main Icon - Bold N Monogram */}
                <svg
                    viewBox="0 0 48 48"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-full h-full"
                >
                    <defs>
                        {/* Primary Gradient */}
                        <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#06b6d4" />
                            <stop offset="50%" stopColor="#8b5cf6" />
                            <stop offset="100%" stopColor="#a855f7" />
                        </linearGradient>

                        {/* Subtle glow */}
                        <filter id="logoGlow" x="-20%" y="-20%" width="140%" height="140%">
                            <feGaussianBlur stdDeviation="1" result="blur"/>
                            <feMerge>
                                <feMergeNode in="blur"/>
                                <feMergeNode in="SourceGraphic"/>
                            </feMerge>
                        </filter>
                    </defs>

                    {/* Background - Clean rounded square */}
                    <rect
                        x="2"
                        y="2"
                        width="44"
                        height="44"
                        rx="12"
                        fill="url(#logoGradient)"
                    />

                    {/* Bold N letterform - Strong and minimal */}
                    <path
                        d="M14 34V14H18.5L29.5 28V14H34V34H29.5L18.5 20V34H14Z"
                        fill="white"
                        filter={animated ? "url(#logoGlow)" : undefined}
                    />

                    {/* Fiber dot accent - Disruptive element */}
                    <circle
                        cx="37"
                        cy="11"
                        r="3"
                        fill="white"
                        opacity="0.9"
                        className={animated ? "animate-pulse" : ""}
                    />
                </svg>
            </div>

            {/* Text Container - Apple-inspired typography */}
            {showText && (
                <div className="flex flex-col justify-center whitespace-nowrap">
                    <div className="flex items-baseline">
                        <span
                            className="text-xl font-semibold tracking-tight"
                            style={{
                                color: 'var(--text-primary)',
                                fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif'
                            }}
                        >
                            NextGen
                        </span>
                    </div>
                    <span
                        className="text-[10px] font-medium tracking-wide"
                        style={{
                            color: 'var(--text-tertiary)',
                            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif'
                        }}
                    >
                        Fiber Intelligence
                    </span>
                </div>
            )}
        </div>
    );
};

export default Logo;
