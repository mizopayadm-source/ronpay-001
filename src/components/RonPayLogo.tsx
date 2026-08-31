import React from 'react';

interface RonPayLogoProps {
  size?: number | string;
  showText?: boolean;
  className?: string;
  animated?: boolean;
}

/**
 * RonPay Official Vector Brand Logo
 * Matches the official Rupee-styled 'R' with orange gradient, white dynamic slash,
 * deep navy squircle badge, and crisp "RonPay" typography.
 */
export const RonPayLogo: React.FC<RonPayLogoProps> = ({
  size = 56,
  showText = true,
  className = '',
  animated = false,
}) => {
  const numericSize = typeof size === 'number' ? size : parseInt(size, 10) || 56;
  const iconSize = showText ? numericSize * 0.72 : numericSize;

  return (
    <div className={`inline-flex flex-col items-center justify-center select-none ${className}`}>
      {/* Logo Squircle Badge */}
      <div 
        style={{ width: iconSize, height: iconSize }}
        className={`relative flex items-center justify-center rounded-[22%] bg-gradient-to-b from-[#14294d] via-[#0d1d38] to-[#081224] p-[8%] shadow-[0_8px_24px_rgba(0,0,0,0.45),0_2px_6px_rgba(249,115,22,0.2)] border border-[#1e3a6b]/60 ${animated ? 'animate-pulse' : ''}`}
      >
        {/* Subtle inner highlight */}
        <div className="absolute inset-0 rounded-[22%] bg-gradient-to-tr from-transparent via-white/5 to-white/15 pointer-events-none" />

        <svg
          viewBox="0 0 100 100"
          className="w-full h-full relative z-10"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Vibrant Orange Gradient for the Rupee R */}
            <linearGradient id="ronpayOrangeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FB923C" />
              <stop offset="40%" stopColor="#F97316" />
              <stop offset="100%" stopColor="#EA580C" />
            </linearGradient>

            {/* Subtle gloss overlay */}
            <linearGradient id="ronpayWhiteSlash" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="100%" stopColor="#E2E8F0" />
            </linearGradient>

            <filter id="ronpayGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#f97316" floodOpacity="0.35" />
            </filter>
          </defs>

          {/* Left Vertical Pillar of R */}
          <rect
            x="20"
            y="18"
            width="12"
            height="64"
            rx="3"
            fill="url(#ronpayOrangeGrad)"
          />

          {/* Upper Rupee Crossbar (Top line) */}
          <rect
            x="20"
            y="26"
            width="34"
            height="8"
            rx="2.5"
            fill="url(#ronpayOrangeGrad)"
          />

          {/* Lower Rupee Crossbar (Middle line) */}
          <rect
            x="20"
            y="42"
            width="28"
            height="7"
            rx="2"
            fill="url(#ronpayOrangeGrad)"
          />

          {/* Upper R Curve / Loop */}
          <path
            d="M32 18H56C69 18 78 27 78 39C78 51 69 60 56 60H32V48H54C60 48 65 44 65 39C65 34 60 30 54 30H32V18Z"
            fill="url(#ronpayOrangeGrad)"
            filter="url(#ronpayGlow)"
          />

          {/* Distinctive White / Silver Diagonal Slash */}
          <path
            d="M32 50L60 82H76L46 50H32Z"
            fill="url(#ronpayWhiteSlash)"
            filter="drop-shadow(0 2px 4px rgba(0,0,0,0.5))"
          />
        </svg>
      </div>

      {/* RonPay Typography */}
      {showText && (
        <div className="mt-2 text-center tracking-tight leading-none">
          <span 
            style={{ fontSize: Math.max(14, numericSize * 0.32) }}
            className="font-extrabold text-white tracking-tight font-sans drop-shadow-md inline-block"
          >
            Ron<span className="text-[#f97316]">Pay</span>
          </span>
        </div>
      )}
    </div>
  );
};
