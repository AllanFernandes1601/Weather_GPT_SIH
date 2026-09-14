import React, { useState } from 'react';
import { SUGGESTED_QUESTIONS } from '../data/mockWeatherData';
import { SuggestedQuestion } from '../types';
import { aiWeatherService, AIResponse } from '../services/aiWeatherService';

interface AIWeatherInputProps {
  locationName: string;
  isVoiceActive: boolean;
  onToggleVoice: () => void;
}

export const AIWeatherInput: React.FC<AIWeatherInputProps> = ({
  locationName,
  isVoiceActive,
  onToggleVoice
}) => {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeResponse, setActiveResponse] = useState<AIResponse | null>(null);

  const handleAsk = async (textToAsk?: string) => {
    const questionText = textToAsk || query;
    if (!questionText.trim()) return;

    setIsLoading(true);
    try {
      const response = await aiWeatherService.askWeatherGPT(questionText, locationName);
      setActiveResponse(response);
      setQuery(questionText);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChipClick = (q: SuggestedQuestion) => {
    setQuery(q.text);
    handleAsk(q.text);
  };

  const handleClearResponse = () => {
    setActiveResponse(null);
    setQuery('');
  };

  return (
    <section
      id="ask-weathergpt-container"
      className="relative rounded-3xl sm:rounded-4xl bg-gradient-to-b from-[#FFFDF9] via-[#FCF9F3] to-[#F7EFE1] p-6 sm:p-10 lg:p-12 shadow-[0_8px_40px_rgba(46,40,35,0.08)] border-2 border-[#B45309]/30 overflow-hidden transition-all duration-300 hover:shadow-[0_16px_50px_rgba(217,119,6,0.12)] hover:border-[#B45309]/50"
    >
      {/* Subtle atmospheric glow backdrop */}
      <div className="absolute -right-20 -top-20 w-96 h-96 bg-amber-200/30 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -left-20 -bottom-20 w-96 h-96 bg-blue-100/40 rounded-full blur-3xl pointer-events-none" />

      {/* Header bar with Neural badge and Doppler audio link status */}
      <div className="flex items-center justify-between pb-6 mb-2 border-b border-[#E5DCCF]/60 flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-[#B45309] flex items-center justify-center shadow-lg shadow-amber-500/25 text-white">
            <span className="material-symbols-outlined text-[28px] animate-pulse">
              auto_awesome
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-[28px] sm:text-[34px] leading-tight font-bold text-[#1C1814] tracking-tight">
                Ask WeatherGPT
              </h2>
              <span className="px-3 py-0.5 rounded-full text-[11px] uppercase font-bold anim-shimmer text-amber-950 border border-amber-300 shadow-sm">
                Neural V4.2
              </span>
            </div>
            <p className="text-[14px] sm:text-[16px] text-[#6E645A] mt-0.5">
              India's conversational meteorological AI assistant. Hyper-local forecasts, commute safety, and disaster advisories in{' '}
              <span className="font-semibold text-[#1C1814]">English</span>,{' '}
              <span className="font-semibold text-[#1C1814]">हिंदी</span>, and{' '}
              <span className="font-semibold text-[#1C1814]">ಕನ್ನಡ</span>.
            </p>
          </div>
        </div>

        {/* Voice to Cloud Live Telemetry Indicator Pill */}
        <div 
          id="voice-cloud-status"
          onClick={onToggleVoice}
          className={`flex items-center gap-3 px-4 py-2 rounded-2xl border shadow-sm backdrop-blur-md transition-all cursor-pointer ${
            isVoiceActive
              ? 'bg-amber-100 border-amber-500 ring-2 ring-amber-400/40'
              : 'bg-white/90 border-[#B45309]/30 hover:border-[#B45309]'
          }`}
          title="Click to toggle Voice Link"
        >
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#D97706] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#D97706]"></span>
            </span>
            <span className="text-[11px] font-bold uppercase text-[#B45309] tracking-wide">
              {isVoiceActive ? 'Voice Link: Online' : 'Cloud Voice Link: Synoptic Stream'}
            </span>
          </div>
          <span className="h-3.5 w-px bg-[#E5DCCF]" />
          <div className="flex items-end gap-1 h-3.5" title="Live audio telemetry">
            <span className="w-1 bg-[#C2410C] rounded-full wave-bar-1 h-2.5" />
            <span className="w-1 bg-amber-500 rounded-full wave-bar-2 h-4" />
            <span className="w-1 bg-[#D97706] rounded-full wave-bar-3 h-3" />
            <span className="w-1 bg-[#C2410C] rounded-full wave-bar-4 h-3.5" />
          </div>
        </div>
      </div>

      {/* Central Input Box */}
      <div className="relative w-full my-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAsk();
          }}
          className="relative flex flex-col md:flex-row items-stretch md:items-center w-full bg-white rounded-3xl p-3 sm:p-4 border-2 border-[#B45309]/40 shadow-[0_6px_28px_rgba(46,40,35,0.07)] focus-within:ring-4 focus-within:ring-[#B45309]/20 focus-within:border-[#B45309] transition-all duration-300 gap-3"
        >
          <div className="flex items-center flex-1 pl-2 pr-2">
            <span className="material-symbols-outlined text-[#B45309] text-[26px] sm:text-[28px] mr-3">
              psychology
            </span>
            <input
              id="weathergpt-input"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask about rainfall timing, route waterlogging, umbrella necessity, or weekend monsoon outlook..."
              className="w-full bg-transparent text-[#1C1814] text-[15px] sm:text-[17px] placeholder:text-[#6E645A]/60 focus:outline-none py-2"
            />
          </div>

          <div className="flex items-center gap-2.5 shrink-0 justify-end">
            {/* Prominent Voice to Cloud copilot trigger */}
            <button
              id="cloud-voice-btn"
              type="button"
              onClick={onToggleVoice}
              className={`button-ripple-target group relative px-4 sm:px-5 py-3 rounded-2xl border-2 transition-all duration-200 flex items-center gap-2.5 shadow-sm active:scale-95 cursor-pointer ${
                isVoiceActive
                  ? 'bg-[#D97706] text-white border-amber-600 ring-4 ring-[#B45309]/30'
                  : 'bg-amber-500/10 hover:bg-amber-500/20 active:bg-amber-500/30 border-amber-500/40 text-[#B45309] hover:text-amber-900'
              }`}
              title="Speak to Weather Cloud (English, हिंदी, ಕನ್ನಡ)"
            >
              <div className="relative flex items-center justify-center">
                <span className="material-symbols-outlined text-[22px] transition-transform group-hover:scale-110">
                  mic
                </span>
                <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-[#D97706] animate-ping" />
              </div>
              <div className="flex flex-col text-left">
                <span className="text-[12px] font-bold leading-none">Voice to Cloud</span>
                <span className="text-[10px] opacity-80 uppercase tracking-wider mt-0.5">
                  HAL Radar Synced
                </span>
              </div>
              <div className="flex items-end gap-0.5 h-3.5 ml-1">
                <span className="w-0.5 bg-current rounded-full wave-bar-1 h-2" />
                <span className="w-0.5 bg-current rounded-full wave-bar-2 h-3.5" />
                <span className="w-0.5 bg-current rounded-full wave-bar-3 h-2" />
                <span className="w-0.5 bg-current rounded-full wave-bar-4 h-3" />
              </div>
            </button>

            {/* Submit button */}
            <button
              id="ask-submit-btn"
              type="submit"
              disabled={isLoading || !query.trim()}
              className="button-ripple-target px-6 sm:px-8 py-3 rounded-2xl bg-gradient-to-r from-[#D97706] to-amber-600 hover:from-[#B45309] hover:to-amber-700 text-white text-[15px] sm:text-[16px] font-bold active:scale-95 transition-all duration-200 flex items-center gap-2 shadow-lg shadow-amber-600/30 hover:shadow-xl hover:shadow-amber-600/40 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <span>{isLoading ? 'Analyzing...' : 'Ask WeatherGPT'}</span>
              <span className="material-symbols-outlined text-[18px] transition-transform duration-200 group-hover:translate-x-1">
                send
              </span>
            </button>
          </div>
        </form>

        {/* Voice listening active feedback banner */}
        {isVoiceActive && (
          <div 
            id="voice-active-notice"
            className="mt-3 p-3.5 rounded-2xl bg-gradient-to-r from-amber-50 via-blue-50 to-amber-50 border border-[#B45309]/40 flex items-center justify-between text-[#1C1814] shadow-sm transition-all duration-300"
          >
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-[#B45309] text-[22px] animate-pulse">
                sensors
              </span>
              <span className="text-[13px] sm:text-[14px] font-semibold text-[#B45309]">
                Listening to voice... Analyzing atmospheric cloud data for {locationName} Urban
              </span>
            </div>
            <div className="flex items-center gap-2 text-[#B45309] text-[11px] font-bold uppercase">
              <span>Synoptic Cloud Stream Active</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            </div>
          </div>
        )}

        {/* Conversational AI Response Card when query answered */}
        {activeResponse && (
          <div 
            id="ai-response-card"
            className="mt-4 p-5 rounded-2xl bg-[#FFFDF9] border-2 border-amber-400 shadow-md transition-all duration-300"
          >
            <div className="flex items-start justify-between gap-3 border-b border-amber-200/60 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-xl bg-amber-500/20 text-[#B45309] flex items-center justify-center font-bold">
                  <span className="material-symbols-outlined text-[20px]">smart_toy</span>
                </span>
                <div>
                  <h4 className="text-[14px] font-bold text-[#1C1814] leading-snug">
                    WeatherGPT Advisory • {activeResponse.timestamp}
                  </h4>
                  <p className="text-[12px] text-[#6E645A]">
                    Target: <span className="font-semibold text-[#1C1814]">{activeResponse.query}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase ${
                    activeResponse.riskLevel === 'High'
                      ? 'bg-rose-100 text-rose-800 border border-rose-200'
                      : activeResponse.riskLevel === 'Moderate'
                      ? 'bg-amber-100 text-amber-900 border border-amber-300'
                      : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  }`}
                >
                  {activeResponse.riskLevel} Risk
                </span>
                <button
                  type="button"
                  onClick={handleClearResponse}
                  className="p-1 rounded-lg text-[#6E645A] hover:bg-[#EFE7DB] hover:text-[#1C1814] transition-colors"
                  title="Dismiss answer"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>
            </div>

            <p className="text-[14px] text-[#1C1814] font-medium leading-relaxed mt-3">
              {activeResponse.summary}
            </p>

            <div className="mt-3 p-3 rounded-xl bg-amber-50/70 border border-amber-200/60 flex items-center gap-2 text-[12px] font-semibold text-[#7C2D12]">
              <span className="material-symbols-outlined text-[16px]">schedule</span>
              <span>{activeResponse.timing}</span>
            </div>

            <div className="mt-3 space-y-1.5">
              <span className="text-[11px] uppercase tracking-wider font-bold text-[#6E645A]">
                Key Commuter Precautions:
              </span>
              <ul className="space-y-1 text-[13px] text-[#1C1814]">
                {activeResponse.actionItems.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-amber-600 font-bold">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-3 pt-2 border-t border-[#E5DCCF] flex items-center justify-between text-[11px] text-[#8E9197]">
              <span>{activeResponse.sourceDisclaimer}</span>
              <span className="font-semibold text-[#B45309]">Gemini ready architecture</span>
            </div>
          </div>
        )}
      </div>

      {/* Suggested Prompt Chips */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <span className="text-[11px] uppercase tracking-wider text-[#6E645A] font-bold flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px] text-[#B45309]">
              tips_and_updates
            </span>
            Suggested questions for current conditions:
          </span>
          <span className="text-[11px] text-[#6E645A] flex items-center gap-1">
            <span className="material-symbols-outlined text-[15px] text-emerald-600">
              verified
            </span>
            Simulated Meteorological Intelligence Model (Demo)
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
          {SUGGESTED_QUESTIONS.map((q) => (
            <button
              key={q.id}
              type="button"
              onClick={() => handleChipClick(q)}
              className={`interactive-card group flex items-center gap-3 p-3.5 rounded-2xl bg-[#FFFDF9] hover:bg-amber-50/80 active:scale-[0.98] text-left text-[#1C1814] border border-[#E5DCCF]/80 hover:border-[#B45309] shadow-sm cursor-pointer ${
                q.colSpan || ''
              }`}
            >
              <span
                className={`text-2xl shrink-0 p-2 rounded-xl ${q.bgClass} border ${q.borderClass} group-hover:scale-110 transition-transform`}
              >
                {q.icon}
              </span>
              <div className="flex flex-col">
                <span className="text-[14px] sm:text-[15px] font-semibold text-[#1C1814] group-hover:text-[#B45309] transition-colors leading-snug">
                  {q.text}
                </span>
                <span className="text-[11px] text-[#6E645A] mt-0.5 leading-tight">
                  {q.subtitle}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};
