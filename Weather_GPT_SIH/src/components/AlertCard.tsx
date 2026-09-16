import React from 'react';
import { WeatherAlert } from '../types';

interface AlertCardProps {
  alert: WeatherAlert;
  onViewAlert: () => void;
}

export const AlertCard: React.FC<AlertCardProps> = ({ alert, onViewAlert }) => {
  return (
    <section 
      id="severe-weather-alert-card"
      className="rounded-2xl bg-[#FFFDF9] p-5 sm:p-6 shadow-sm border border-[#E5DCCF]/70 relative overflow-hidden alert-pulsing-border transition-all duration-300 hover:shadow-md"
    >
      {/* Left Accent Bar */}
      <div className="absolute left-0 top-0 bottom-0 w-2 bg-[#EA580C]" />

      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 pl-2">
        <div className="space-y-2 flex-1">
          {/* Metadata badges */}
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-amber-100 text-[#7C2D12] text-[11px] uppercase font-bold border border-amber-200 shadow-sm">
              <span className="material-symbols-outlined text-[16px] animate-bounce" style={{ animationDuration: '2.2s' }}>
                warning
              </span>
              {alert.badgeText}
            </span>
            <span className="text-[12px] text-[#6E645A]">
              Advisory Ref: <span className="font-semibold text-[#1C1814]">{alert.bulletinRef}</span>
            </span>
            <span className="text-[11px] text-[#6E645A] bg-[#E8DEC8] px-2 py-0.5 rounded-md font-medium">
              {alert.stage}
            </span>
          </div>

          {/* Alert Title */}
          <h3 className="text-[18px] sm:text-[20px] text-[#1C1814] font-bold leading-snug">
            {alert.title}
          </h3>

          {/* Alert Description */}
          <p className="text-[14px] sm:text-[15px] text-[#6E645A] max-w-4xl leading-relaxed">
            Localized convective cloud burst expected between{' '}
            <strong className="text-[#1C1814] font-semibold">{alert.timeWindow}</strong>.
            Potential waterlogging on Outer Ring Road, Bellandur, and Whitefield transit corridors.
            Commuters are advised to pace travel times.
          </p>
        </div>

        {/* Action Button */}
        <div className="shrink-0 flex items-center gap-3 w-full lg:w-auto">
          <button
            id="view-alert-details-btn"
            type="button"
            onClick={onViewAlert}
            className="group w-full lg:w-auto px-5 py-2.5 rounded-full bg-amber-50 hover:bg-amber-100 text-[#B45309] border border-amber-200/80 text-[14px] font-semibold transition-all duration-200 flex items-center justify-center gap-2 shadow-sm hover:shadow active:scale-95 cursor-pointer"
          >
            <span>View Full Alert &amp; Route Precautions</span>
            <span className="material-symbols-outlined text-[18px] transition-transform duration-200 group-hover:translate-x-1.5">
              arrow_forward
            </span>
          </button>
        </div>
      </div>
    </section>
  );
};
