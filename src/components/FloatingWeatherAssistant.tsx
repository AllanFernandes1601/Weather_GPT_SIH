import React, { useEffect, useMemo, useState } from 'react';
import { LocationData, NavTab } from '../types';

interface FloatingWeatherAssistantProps {
  location: LocationData;
  currentTab: NavTab;
  isLoading: boolean;
  children: React.ReactNode;
}

type WeatherTone = 'amber' | 'blue' | 'slate' | 'indigo';

function getWeatherTone(location: LocationData): WeatherTone {
  const value = `${location.condition} ${location.weatherIcon || ''}`.toLowerCase();
  if (/rain|storm|drizzle|shower|thunder/.test(value)) return 'blue';
  if (location.isDay === false || /night|moon|bedtime/.test(value)) return 'indigo';
  if (/cloud|overcast|fog|mist|haze/.test(value)) return 'slate';
  return 'amber';
}

const toneClasses: Record<WeatherTone, string> = {
  amber: 'from-amber-400 via-orange-400 to-amber-600 shadow-orange-500/30',
  blue: 'from-sky-400 via-blue-500 to-indigo-600 shadow-blue-500/30',
  slate: 'from-slate-400 via-slate-500 to-blue-700 shadow-slate-500/30',
  indigo: 'from-indigo-400 via-slate-600 to-indigo-800 shadow-indigo-500/30'
};

export const FloatingWeatherAssistant: React.FC<FloatingWeatherAssistantProps> = ({
  location,
  currentTab,
  isLoading,
  children
}) => {
  const [hasScrolled, setHasScrolled] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const tone = useMemo(() => getWeatherTone(location), [location]);

  useEffect(() => {
    const update = () => setHasScrolled(window.scrollY > 260);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [isOpen]);

  return (
    <div
      className={`fixed bottom-5 right-4 z-[70] transition-all duration-500 ease-out sm:bottom-7 sm:right-7 ${
        hasScrolled || currentTab !== 'home' ? 'translate-y-0 scale-100' : 'translate-y-1 scale-[0.96]'
      }`}
    >
      {isOpen && (
        <section
          role="dialog"
          aria-modal="false"
          aria-label="WeatherGPT quick assistant"
          className="floating-assistant-panel absolute bottom-[76px] right-0 flex max-h-[min(76vh,720px)] w-[min(92vw,620px)] flex-col overflow-hidden rounded-3xl border border-[#E2D4C3] bg-[#FAF8F5]/98 shadow-[0_24px_80px_rgba(38,30,22,0.28)] backdrop-blur-xl"
        >
          <header className="flex shrink-0 items-center justify-between border-b border-[#E8DED2] bg-gradient-to-r from-[#FFF9EE] to-[#FFFDF9] px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${toneClasses[tone]} text-white shadow-md`}>
                <span className="material-symbols-outlined text-[23px]">{location.weatherIcon || 'partly_cloudy_day'}</span>
              </span>
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-[#211B16]">WeatherGPT quick assistant</p>
                <p className="truncate text-[10px] font-medium text-[#76695E]">
                  {location.name} · {location.temperature}° · {location.condition}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Close WeatherGPT assistant"
              className="flex h-9 w-9 items-center justify-center rounded-full text-[#6E645A] transition-colors hover:bg-amber-100 hover:text-[#B45309]"
            >
              <span className="material-symbols-outlined text-[21px]">close</span>
            </button>
          </header>
          <div className="min-h-0 overflow-y-auto p-3 sm:p-4">
            {children}
          </div>
        </section>
      )}

      <button
        type="button"
        onClick={() => setIsOpen(open => !open)}
        aria-expanded={isOpen}
        aria-label={`Ask WeatherGPT. Current weather in ${location.name}: ${location.temperature} degrees, ${location.condition}`}
        title={isOpen ? 'Close WeatherGPT' : 'Ask WeatherGPT'}
        className="floating-weather-bot group relative flex items-center gap-2.5 rounded-full border border-white/70 bg-[#FFFDF9]/95 p-1.5 pr-3 shadow-[0_12px_35px_rgba(40,32,24,0.22)] backdrop-blur-xl transition-transform duration-300 hover:-translate-y-1 hover:scale-[1.03] focus:outline-none focus-visible:ring-4 focus-visible:ring-amber-400/40"
      >
        <span className={`weather-bot-ring absolute inset-0 rounded-full bg-gradient-to-r ${toneClasses[tone]} opacity-25`} />
        <span className={`relative flex h-13 w-13 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br ${toneClasses[tone]} text-white shadow-lg sm:h-14 sm:w-14`}>
          <span className="absolute -right-2 -top-2 h-7 w-7 rounded-full bg-white/25 blur-[1px]" />
          <span className={`material-symbols-outlined relative text-[29px] drop-shadow-sm ${isLoading ? 'animate-pulse' : ''}`}>
            {isLoading ? 'sync' : location.weatherIcon || (location.isDay === false ? 'bedtime' : 'partly_cloudy_day')}
          </span>
          <span className="absolute bottom-1 right-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-400" />
        </span>

        <span className="relative hidden min-w-0 text-left sm:block">
          <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-[#B45309]">Ask WeatherGPT</span>
          <span className="mt-0.5 block max-w-[150px] truncate text-[11px] font-semibold text-[#2B241E]">
            {location.temperature}° · {location.condition}
          </span>
        </span>

        <span className="material-symbols-outlined relative hidden text-[18px] text-[#B45309] transition-transform duration-300 group-hover:translate-x-0.5 sm:block">
          {isOpen ? 'close' : 'chat_bubble'}
        </span>
      </button>
    </div>
  );
};
