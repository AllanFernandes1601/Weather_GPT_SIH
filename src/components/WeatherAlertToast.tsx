import React, { useEffect } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { formatAlertType, formatSeverity } from '../utils/alertLabels';

export interface WeatherAlertToastData {
  id: number;
  location: string;
  body: string;
}

interface WeatherAlertToastProps {
  alert: WeatherAlertToastData | null;
  onDismiss: () => void;
}

export const WeatherAlertToast: React.FC<WeatherAlertToastProps> = ({ alert, onDismiss }) => {
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (!alert) {
      return undefined;
    }

    const timeoutId = window.setTimeout(onDismiss, 6000);
    return () => window.clearTimeout(timeoutId);
  }, [alert, onDismiss]);

  return (
    <AnimatePresence mode="wait">
      {alert && (
        <motion.div
          key={alert.id}
          role="status"
          aria-live="assertive"
          initial={{ opacity: 0, y: shouldReduceMotion ? 0 : -40, scale: shouldReduceMotion ? 1 : 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: shouldReduceMotion ? 0 : -30, scale: shouldReduceMotion ? 1 : 0.98 }}
          transition={{ duration: 0.32, ease: 'easeOut' }}
          className="fixed top-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-[500px] -translate-x-1/2 overflow-hidden rounded-2xl border border-amber-300/80 bg-[#FFFDF9] shadow-[0_16px_45px_rgba(92,58,15,0.2)]"
        >
          <div className="h-1 bg-gradient-to-r from-amber-500 via-[#EA580C] to-red-600" />
          <div className="flex items-start gap-3 p-4 sm:p-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-[#B45309] border border-amber-200">
              <span className="material-symbols-outlined text-[22px]">thunderstorm</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="text-[12px] font-bold text-[#6E645A]">WeatherGPT</span>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#92400E]">
                  Demo Mode
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold tracking-wider text-red-700 border border-red-200">
                  {formatSeverity('high')}
                </span>
                <h3 className="text-[15px] font-bold text-[#1C1814]">{formatAlertType('heavy_rain')} Alert</h3>
              </div>
              <p className="text-[12px] font-semibold text-[#B45309]">{alert.location}</p>
              <p className="mt-2 text-[13px] leading-relaxed text-[#6E645A]">{alert.body}</p>
            </div>
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Dismiss weather alert"
              title="Dismiss weather alert"
              className="shrink-0 rounded-lg p-1 text-[#8E9197] transition-colors hover:bg-[#F5F0E8] hover:text-[#1C1814] focus:outline-none focus:ring-2 focus:ring-amber-500/30"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
