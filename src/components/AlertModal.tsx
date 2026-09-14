import React from 'react';
import { WeatherAlert } from '../types';

interface AlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  alert: WeatherAlert;
}

export const AlertModal: React.FC<AlertModalProps> = ({ isOpen, onClose, alert }) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-2xl bg-[#FFFDF9] rounded-3xl border border-[#E5DCCF] shadow-2xl p-6 sm:p-8 relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Accent strip */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-[#EA580C]" />

        {/* Header */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-[#E5DCCF]">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-amber-100 text-[#7C2D12] text-[11px] uppercase font-bold border border-amber-200 shadow-sm">
                <span className="material-symbols-outlined text-[15px]">warning</span>
                {alert.badgeText}
              </span>
              <span className="text-[12px] text-[#6E645A]">
                Ref: <strong className="text-[#1C1814]">{alert.bulletinRef}</strong>
              </span>
            </div>
            <h2 className="text-[20px] sm:text-[22px] font-bold text-[#1C1814] leading-snug">
              {alert.title}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-[#F2EBE1] text-[#6E645A] hover:text-[#1C1814] transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="py-4 space-y-5 max-h-[60vh] overflow-y-auto pr-1">
          {/* Active Timing */}
          <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200/80 flex items-center gap-3">
            <span className="material-symbols-outlined text-[#B45309] text-[24px]">
              schedule
            </span>
            <div>
              <span className="text-[11px] uppercase font-bold text-[#B45309] tracking-wider block">
                Peak Atmospheric Activity Window
              </span>
              <span className="text-[14px] font-bold text-[#1C1814]">
                {alert.timeWindow} (Expected Duration: ~4.5 Hours)
              </span>
            </div>
          </div>

          {/* Description */}
          <div>
            <h4 className="text-[12px] uppercase tracking-wider font-bold text-[#6E645A] mb-1">
              Meteorological Assessment
            </h4>
            <p className="text-[14px] text-[#1C1814] leading-relaxed">
              {alert.description}
            </p>
          </div>

          {/* Affected Corridors */}
          <div>
            <h4 className="text-[12px] uppercase tracking-wider font-bold text-[#6E645A] mb-2">
              High-Risk Waterlogging Corridors
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {alert.affectedCorridors.map((corridor, idx) => (
                <div key={idx} className="p-2.5 rounded-xl bg-[#F5F0E8] border border-[#E5DCCF]/60 flex items-center gap-2 text-[12px] font-medium text-[#1C1814]">
                  <span className="material-symbols-outlined text-[#EA580C] text-[16px]">
                    fmd_bad
                  </span>
                  <span>{corridor}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Route Precautions */}
          <div>
            <h4 className="text-[12px] uppercase tracking-wider font-bold text-[#6E645A] mb-2">
              Commuter Route Precautions
            </h4>
            <ul className="space-y-2 text-[13px] text-[#1C1814]">
              {alert.routePrecautions.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2.5 p-2 rounded-xl hover:bg-[#F5F0E8] transition-colors">
                  <span className="material-symbols-outlined text-[#B45309] text-[16px] mt-0.5 shrink-0">
                    directions_car
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Civil Defense Checklist */}
          <div>
            <h4 className="text-[12px] uppercase tracking-wider font-bold text-[#6E645A] mb-2">
              Disaster Management Checklist
            </h4>
            <div className="space-y-1.5">
              {alert.safetyChecklist.map((check, idx) => (
                <div key={idx} className="flex items-center gap-2 text-[13px] text-[#1C1814]">
                  <span className="material-symbols-outlined text-emerald-600 text-[18px]">
                    check_circle
                  </span>
                  <span>{check}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-[#E5DCCF] flex items-center justify-between">
          <span className="text-[11px] text-[#8E9197]">
            Demo Weather Advisory • Configurable Municipal Alert Stream
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-full bg-[#D97706] hover:bg-[#B45309] text-white font-semibold text-[13px] transition-colors shadow-sm cursor-pointer"
          >
            Acknowledge Advisory
          </button>
        </div>
      </div>
    </div>
  );
};
