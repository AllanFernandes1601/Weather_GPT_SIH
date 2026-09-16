import React from 'react';

interface WeatherMetricCardProps {
  label: string;
  value: string | number;
  subtext: string;
  subtextColor?: string;
  className?: string;
  id?: string;
}

export const WeatherMetricCard: React.FC<WeatherMetricCardProps> = ({
  label,
  value,
  subtext,
  subtextColor = 'text-[#6E645A]',
  className = '',
  id
}) => {
  return (
    <div
      id={id}
      className={`interactive-card p-3 rounded-2xl bg-white/90 backdrop-blur-sm border border-[#E5DCCF]/60 shadow-sm flex flex-col justify-between cursor-default ${className}`}
    >
      <span className="text-[11px] text-[#6E645A] uppercase font-bold tracking-wider">
        {label}
      </span>
      <span className="text-[18px] sm:text-[20px] text-[#1C1814] font-semibold mt-1 leading-tight">
        {value}
      </span>
      <span className={`text-[12px] font-medium truncate ${subtextColor}`}>
        {subtext}
      </span>
    </div>
  );
};
