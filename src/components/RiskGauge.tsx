import React, { useId } from 'react';
import { RiskLevel } from '../utils/riskEngine';

interface RiskGaugeProps {
  value: number;
  displayValue: string;
  title: string;
  level: RiskLevel;
  isLive: boolean;
  isHighlighted: boolean;
}

export const RiskGauge: React.FC<RiskGaugeProps> = ({
  value,
  displayValue,
  title,
  level,
  isLive,
  isHighlighted
}) => {
  const gradientId = useId().replace(/:/g, '');
  const safeValue = Math.min(100, Math.max(0, value));
  const angle = -90 + safeValue * 1.8;

  return (
    <div className={`risk-gauge-wrap ${isLive && isHighlighted ? 'risk-gauge-live-highlight' : ''}`}>
      <svg
        className="w-full max-w-[250px] mx-auto overflow-visible"
        viewBox="0 0 220 138"
        role="img"
        aria-label={`${title}: ${level}, ${displayValue}`}
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#22C55E" />
            <stop offset="34%" stopColor="#EAB308" />
            <stop offset="68%" stopColor="#F97316" />
            <stop offset="100%" stopColor="#DC2626" />
          </linearGradient>
        </defs>
        <path
          d="M 28 108 A 82 82 0 0 1 192 108"
          fill="none"
          stroke="#E7DED1"
          strokeWidth="19"
          strokeLinecap="round"
        />
        <path
          d="M 28 108 A 82 82 0 0 1 192 108"
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth="14"
          strokeLinecap="round"
        />
        {[0, 25, 50, 75, 100].map(mark => {
          const radians = (-180 + mark * 1.8) * Math.PI / 180;
          const x1 = 110 + Math.cos(radians) * 69;
          const y1 = 108 + Math.sin(radians) * 69;
          const x2 = 110 + Math.cos(radians) * 78;
          const y2 = 108 + Math.sin(radians) * 78;
          return <line key={mark} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#FFFDF9" strokeWidth="2" />;
        })}
        <g
          className="risk-gauge-needle"
          style={{ transform: `rotate(${angle}deg)`, transformOrigin: '110px 108px' }}
        >
          <line x1="110" y1="108" x2="110" y2="43" stroke="#29211B" strokeWidth="4" strokeLinecap="round" />
          <path d="M 106 47 L 110 36 L 114 47 Z" fill="#29211B" />
        </g>
        <circle cx="110" cy="108" r="10" fill="#FFFDF9" stroke="#29211B" strokeWidth="5" />
        <text x="110" y="133" textAnchor="middle" className="fill-[#1C1814] text-[15px] font-bold">
          {displayValue}
        </text>
      </svg>
      <div className="grid grid-cols-4 text-[8px] uppercase tracking-wide font-bold text-[#8E7965] -mt-1">
        <span>Low</span>
        <span className="text-center">Moderate</span>
        <span className="text-center">High</span>
        <span className="text-right">Severe</span>
      </div>
    </div>
  );
};
