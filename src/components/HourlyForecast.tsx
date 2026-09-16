import React from 'react';
import { HourlyForecastItem } from '../types';

interface HourlyForecastProps {
  forecastItems: HourlyForecastItem[];
  isLive?: boolean;
}

export const HourlyForecast: React.FC<HourlyForecastProps> = ({ forecastItems, isLive = true }) => {
  return (
    <section id="hourly-forecast-section" className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[20px] sm:text-[22px] font-bold text-[#1C1814]">
            Today's Forecast
          </h3>
          <p className="text-[13px] text-[#6E645A]">
            Next 24 Hours • 1-hour intervals with precipitation probability
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2">
          <span className="text-[12px] text-[#6E645A] font-medium bg-[#F5F0E8] px-3 py-1 rounded-full border border-[#E5DCCF]/60">
            {isLive ? 'Live Open-Meteo Forecast' : 'Demo Hourly (Fallback)'}
          </span>
        </div>
      </div>

      <div className="overflow-x-auto no-scrollbar pb-2 -mx-2 px-2">
        <div className="grid grid-flow-col auto-cols-[minmax(130px,1fr)] sm:grid-cols-4 lg:grid-cols-8 gap-3 min-w-[720px] lg:min-w-0">
          {forecastItems.slice(0, 24).map((item, index) => {
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

            return (
              <div
                key={index}
                className={`interactive-card group flex flex-col items-center justify-between p-4 rounded-2xl bg-[#FFFDF9] border ${cardStyle} ${ringStyle} shadow-sm text-center cursor-default min-w-[125px]`}
              >
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

                <span className="material-symbols-outlined text-[32px] my-2 text-amber-500 group-hover:scale-110 transition-transform duration-300">
                  {item.icon}
                </span>

                <span className="text-[22px] font-bold text-[#1C1814]">
                  {item.temperature}°
                </span>

                <div className="w-full mt-3 space-y-1">
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
