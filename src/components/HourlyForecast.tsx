import React from 'react';
import { HourlyForecastItem } from '../types';

interface HourlyForecastProps {
  forecastItems: HourlyForecastItem[];
  isLive?: boolean;
}

export const HourlyForecast: React.FC<HourlyForecastProps> = ({ forecastItems, isLive = true }) => {
  const visibleItems = forecastItems.slice(0, 12);
  const firstDate = visibleItems[0]?.forecastTime?.slice(0, 10);

  return (
    <section id="hourly-forecast-section" className="space-y-4 overflow-hidden rounded-3xl border border-[#E5DCCF]/70 bg-[#FFFDF9] p-5 shadow-sm sm:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[20px] sm:text-[22px] font-bold text-[#1C1814]">
            Hourly Forecast
          </h3>
          <p className="text-[13px] text-[#6E645A]">
            Next 12 hours • Temperature, conditions and rain probability
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2">
          <span className="text-[12px] text-[#6E645A] font-medium bg-[#F5F0E8] px-3 py-1 rounded-full border border-[#E5DCCF]/60">
            {isLive ? 'Live Open-Meteo Forecast' : 'Demo Hourly (Fallback)'}
          </span>
        </div>
      </div>

      <div className="-mx-2 overflow-x-auto px-2 pb-2 no-scrollbar snap-x snap-mandatory">
        <div className="flex min-w-max gap-2.5">
          {visibleItems.map((item, index) => {
            let cardStyle = 'border-[#E5DCCF]/70';
            let barColor = 'bg-[#D97706]';
            let textColor = 'text-[#B45309]';
            let ringStyle = '';

            if (item.isNow) {
              cardStyle = 'border-2 border-[#D97706]/70';
              ringStyle = 'ring-2 ring-[#D97706]/10';
            } else if (item.isPeakStorm) {
              cardStyle = 'border-2 border-[#EA580C]/70';
              ringStyle = 'ring-2 ring-[#EA580C]/40';
              barColor = 'bg-[#EA580C]';
              textColor = 'text-[#C2410C] font-bold';
            } else if (item.isWarning) {
              cardStyle = 'border border-[#EA580C]/40';
              ringStyle = 'ring-2 ring-[#EA580C]/20';
              barColor = 'bg-[#EA580C]';
              textColor = 'text-[#C2410C] font-bold';
            }

            const datePart = item.forecastTime?.slice(0, 10);
            const dayLabel = !datePart || datePart === firstDate ? 'Today' : 'Tomorrow';

            return (
              <div
                key={item.forecastTime || `${item.time}-${index}`}
                className={`interactive-card group flex w-[112px] shrink-0 snap-start flex-col items-center rounded-2xl bg-[#FFFDF9] border ${cardStyle} ${ringStyle} p-3 shadow-sm text-center cursor-default`}
              >
                <span className="mb-1 text-[9px] font-bold uppercase tracking-[0.12em] text-[#9A8C7E]">
                  {index === 0 ? 'Current' : dayLabel}
                </span>
                <div className="flex items-center gap-1 font-bold text-[13px]">
                  <span className={item.isNow ? 'text-[#B45309]' : 'text-[#6E645A]'}>
                    {item.time}
                  </span>
                  {item.isNow && (
                    <span className="h-1.5 w-1.5 rounded-full bg-[#D97706] animate-ping" />
                  )}
                  {item.isPeakStorm && (
                    <span className="h-1.5 w-1.5 rounded-full bg-[#EA580C] animate-pulse" />
                  )}
                </div>

                <span className="material-symbols-outlined my-2 text-[30px] text-amber-500 transition-transform duration-300 group-hover:scale-110">
                  {item.icon}
                </span>

                <span className="text-[21px] font-bold text-[#1C1814]">
                  {item.temperature}°
                </span>

                <span className="mt-0.5 w-full truncate text-[10px] font-medium text-[#6E645A]" title={item.condition}>
                  {item.condition}
                </span>

                <div className="mt-2.5 w-full space-y-1">
                  <span className={`text-[11px] font-medium block truncate ${textColor}`}>
                    {item.rainProbability}% rain
                  </span>
                  <div className="w-full h-1.5 rounded-full bg-[#F2EBE1] overflow-hidden">
                    <div
                      className={`h-full ${barColor} rounded-full group-hover:brightness-110 transition-all duration-300`}
                      style={{ width: `${item.rainProbability}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
