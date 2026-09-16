import React from 'react';
import { LocationData } from '../types';
import { WeatherMetricCard } from './WeatherMetricCard';

interface WeatherHeroProps {
  location: LocationData;
  isVoiceActive: boolean;
  onToggleVoice: () => void;
  onOpenLocationModal: () => void;
  isLoading?: boolean;
}

export const WeatherHero: React.FC<WeatherHeroProps> = ({
  location,
  isVoiceActive,
  onToggleVoice,
  onOpenLocationModal,
  isLoading = false
}) => {
  return (
    <section 
      id="current-weather-hero"
      className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#FFFDF9] via-[#FAF6EE] to-[#F5ECE0] p-6 sm:p-8 lg:p-10 border border-[#E5DCCF]/70 shadow-[0_4px_24px_rgba(46,40,35,0.05)] transition-all hover:shadow-[0_8px_32px_rgba(46,40,35,0.08)]"
    >
      {/* Ambient background glows */}
      <div 
        className="absolute -right-24 -top-24 w-96 h-96 bg-amber-200/30 rounded-full blur-3xl pointer-events-none animate-pulse" 
        style={{ animationDuration: '6s' }}
      />
      <div className="absolute left-1/3 bottom-0 w-80 h-80 bg-orange-100/40 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Left Column (Meteorological State) */}
        <div className="lg:col-span-7 flex flex-col justify-between space-y-6">
          {/* Status Badges */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/90 backdrop-blur-md border border-[#E5DCCF]/60 shadow-sm transition-all hover:shadow">
              <span className="relative flex h-2.5 w-2.5">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${
                  isLoading
                    ? 'bg-amber-500'
                    : location.isLive !== false
                    ? 'bg-emerald-500'
                    : 'bg-amber-400'
                } opacity-75`}></span>
                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                  isLoading
                    ? 'bg-amber-500'
                    : location.isLive !== false
                    ? 'bg-emerald-600'
                    : 'bg-amber-500'
                }`}></span>
              </span>
              <span className="text-[11px] uppercase tracking-wider text-[#6E645A] font-bold">
                {isLoading
                  ? 'Refreshing Telemetry...'
                  : location.isLive !== false
                  ? 'Live Telemetry • Open-Meteo'
                  : 'Demo Station • Fallback'}
              </span>
            </div>

            <button
              type="button"
              onClick={onOpenLocationModal}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 hover:bg-amber-500/20 text-[#B45309] text-[12px] font-semibold border border-amber-500/20 transition-all cursor-pointer group"
              title="Click to switch location"
            >
              <span className="material-symbols-outlined text-[16px] group-hover:scale-110 transition-transform">
                location_on
              </span>
              <span>
                {location.name}, {location.state} ({location.coordinates})
              </span>
            </button>
          </div>

          {/* Greeting & Giant Temperature */}
          <div className="space-y-2">
            <p className="text-[18px] text-[#6E645A] font-medium font-sans">
              {location.greeting}
            </p>
            <div className="flex items-baseline gap-4 flex-wrap">
              <span className="text-[80px] sm:text-[92px] leading-none font-bold tracking-tight text-[#1C1814] transition-transform duration-300 hover:scale-[1.02] inline-block font-sans">
                {location.temperature}°
              </span>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  {location.weatherIcon && (
                    <span className="material-symbols-outlined text-[26px] text-[#B45309]">
                      {location.weatherIcon}
                    </span>
                  )}
                  <span className="text-[28px] sm:text-[32px] font-semibold text-[#1C1814] leading-tight">
                    {location.condition}
                  </span>
                </div>
                <span className="text-[15px] text-[#6E645A] mt-1 font-medium">
                  Feels like {location.feelsLike}° • High {location.high}° / Low {location.low}°
                </span>
              </div>
            </div>
          </div>

          {/* Quick glance metrics row */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-2">
            <WeatherMetricCard
              id="metric-humidity"
              label="Humidity"
              value={`${location.humidity}%`}
              subtext={location.humidityDesc}
              subtextColor="text-[#B45309]"
            />
            <WeatherMetricCard
              id="metric-wind"
              label="Wind"
              value={`${location.windSpeed} km/h`}
              subtext={`${location.windDirection} Gusts ${location.windGusts}`}
            />
            <WeatherMetricCard
              id="metric-uv"
              label="UV Index"
              value={location.uvIndex}
              subtext={location.uvCategory}
              subtextColor="text-[#C2410C]"
            />
            <WeatherMetricCard
              id="metric-visibility"
              label="Visibility"
              value={`${location.visibility} km`}
              subtext="Optimal"
            />
            <WeatherMetricCard
              id="metric-pressure"
              label="Pressure"
              value={location.pressure}
              subtext={location.pressureTendency}
              className="col-span-2 sm:col-span-1"
            />
          </div>

          {location.rainPrediction && (
            <div className="inline-flex self-start items-center gap-2.5 px-3.5 py-2 rounded-xl bg-blue-50/90 border border-blue-200 text-[#1C1814]">
              <span className="material-symbols-outlined text-blue-700 text-[19px]">rainy</span>
              <span className="text-[12px] font-bold">
                Next-hour rain probability: {Math.round(location.rainPrediction.probability * 100)}%
              </span>
              <span className="text-[11px] text-[#52606D]">Bengaluru ML model</span>
            </div>
          )}
        </div>

        {/* Right Column: Atmospheric Graphic with LIVE VOICE & RADAR ACOUSTIC SYNC */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center relative">
          <div 
            id="hero-weather-cloud-container"
            className={`relative w-full max-w-[340px] aspect-square flex items-center justify-center transition-all duration-500 ${
              isVoiceActive ? 'voice-active-cloud scale-105' : ''
            }`}
          >
            {/* Ambient celestial glow: warm amber/orange for day, cool slate/silver for night */}
            <div 
              className={`absolute inset-4 rounded-full blur-xl animate-pulse transition-all duration-700 ${
                location.isDay !== false
                  ? 'bg-gradient-to-tr from-amber-300/40 to-orange-300/40'
                  : 'bg-gradient-to-tr from-slate-400/30 to-blue-400/20'
              }`} 
              style={{ animationDuration: '5s' }}
            />

            {/* Voice / Acoustic Radar Rings */}
            <div className="radar-ring-1 absolute w-64 h-64 rounded-full border-2 border-[#B45309]/40 pointer-events-none" />
            <div className="radar-ring-2 absolute w-72 h-72 rounded-full border border-amber-500/30 pointer-events-none" />
            <div className="radar-ring-3 absolute w-80 h-80 rounded-full border border-blue-400/25 pointer-events-none" />

            {/* Voice sync active wave telemetry indicator positioned top right of cloud */}
            <div 
              id="cloud-voice-telemetry-badge"
              onClick={onToggleVoice}
              className={`absolute -top-3 right-0 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FFFDF9]/95 border shadow-md backdrop-blur-md cursor-pointer transition-all duration-200 group ${
                isVoiceActive 
                  ? 'border-amber-600 ring-2 ring-amber-400/50 bg-amber-50' 
                  : 'border-[#B45309]/40 hover:border-[#B45309]'
              }`}
              title="Click to toggle Voice Link"
            >
              <div className="flex items-end gap-0.5 h-3.5 px-0.5">
                <span className="w-0.5 bg-[#B45309] rounded-full wave-bar-1 h-3" />
                <span className="w-0.5 bg-[#D97706] rounded-full wave-bar-2 h-4" />
                <span className="w-0.5 bg-amber-500 rounded-full wave-bar-3 h-2" />
                <span className="w-0.5 bg-[#B45309] rounded-full wave-bar-4 h-3.5" />
              </div>
              <span className="text-[10px] tracking-tight uppercase font-bold text-[#B45309] group-hover:text-amber-900 transition-colors">
                {isVoiceActive ? 'Voice Link: Active' : 'Voice & Radar Synced Audio Hub'}
              </span>
            </div>

            {/* SVG Atmospheric Sun / Moon & Translucent Cumulus Layer */}
            <svg 
              id="atmospheric-cloud-svg"
              className="w-72 h-72 drop-shadow-xl z-10 transition-transform duration-500 hover:scale-105 cursor-pointer"
              fill="none" 
              viewBox="0 0 240 240" 
              xmlns="http://www.w3.org/2000/svg"
              onClick={onToggleVoice}
            >
              {/* Celestial Body with breathing pulse (Day Sun vs Night Moon) */}
              <g className="anim-sun-pulse">
                <circle
                  cx="150"
                  cy="85"
                  fill={location.isDay !== false ? "url(#sun-gradient)" : "url(#moon-gradient)"}
                  r="46"
                />
                <circle
                  cx="150"
                  cy="85"
                  r="54"
                  stroke={location.isDay !== false ? "#EA580C" : "#64748B"}
                  strokeOpacity="0.22"
                  strokeWidth="2"
                />
                <circle
                  cx="150"
                  cy="85"
                  r="64"
                  stroke={location.isDay !== false ? "#EA580C" : "#64748B"}
                  strokeDasharray="4 4"
                  strokeOpacity="0.15"
                  strokeWidth="1.5"
                />
              </g>

              {/* Staggered Animated Rain Sprinkles Falling Smoothly */}
              <g id="rain-group">
                <line className="anim-rain-1" stroke="#0284C7" strokeLinecap="round" strokeWidth="2.5" x1="86" x2="82" y1="192" y2="204" />
                <line className="anim-rain-2" stroke="#0284C7" strokeLinecap="round" strokeWidth="2.5" x1="108" x2="104" y1="194" y2="208" />
                <line className="anim-rain-3" stroke="#0284C7" strokeLinecap="round" strokeWidth="2.5" x1="130" x2="126" y1="192" y2="204" />
                <line className="anim-rain-4" stroke="#0284C7" strokeLinecap="round" strokeWidth="2.5" x1="152" x2="148" y1="194" y2="208" />
              </g>

              {/* Ambient floating cumulus cloud layer */}
              <g className="anim-float-cloud" id="cloud-group">
                {/* Back cloud */}
                <path 
                  d="M55 168C42 168 32 157.5 32 144.5C32 132.8 40.5 123.1 51.8 121.3C53.7 101.5 70.3 86 90.8 86C104.2 86 116.1 92.8 123.1 103.2C128.5 98.6 135.5 95.8 143.1 95.8C159.2 95.8 172.4 108.5 172.9 124.5C182.8 126.9 190.2 135.8 190.2 146.5C190.2 158.4 180.6 168 168.7 168H55Z" 
                  fill="url(#cloud-back)" 
                  fillOpacity="0.85" 
                />
                {/* Foreground Soft Frosted Cloud */}
                <path 
                  id="cloud-face"
                  d="M72 184C59.8 184 50 174.2 50 162C50 150.9 58.1 141.8 68.9 140.2C70.7 121.4 86.6 106.8 106.1 106.8C119 106.8 130.4 113.3 137.1 123.3C142.3 119 148.9 116.4 156.1 116.4C171.4 116.4 183.9 128.5 184.4 143.7C193.8 146 201 154.5 201 164.6C201 175.9 191.9 184 180.5 184H72Z" 
                  fill="url(#cloud-front)" 
                />
              </g>

              <defs>
                <linearGradient id="sun-gradient" gradientUnits="userSpaceOnUse" x1="110" x2="188" y1="45" y2="125">
                  <stop stopColor="#FFB300" />
                  <stop offset="1" stopColor="#FF7A00" />
                </linearGradient>
                <linearGradient id="moon-gradient" gradientUnits="userSpaceOnUse" x1="110" x2="188" y1="45" y2="125">
                  <stop stopColor="#CBD5E1" />
                  <stop offset="1" stopColor="#64748B" />
                </linearGradient>
                <linearGradient id="cloud-back" gradientUnits="userSpaceOnUse" x1="32" x2="190" y1="86" y2="168">
                  <stop stopColor="#DEE8FF" />
                  <stop offset="1" stopColor="#B0C6FF" />
                </linearGradient>
                <linearGradient id="cloud-front" gradientUnits="userSpaceOnUse" x1="50" x2="201" y1="106" y2="184">
                  <stop stopColor="#FFFFFF" />
                  <stop offset="1" stopColor="#E7EEFF" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          {/* Radar & Convective status: clear and honest indication without fabricating radar lock */}
          <div 
            id="hero-radar-badge"
            className="mt-3 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/90 backdrop-blur-md border border-[#E5DCCF]/60 shadow-sm transition-all hover:shadow-md cursor-default"
          >
            <div className="relative flex items-center justify-center">
              {location.radarStation !== 'Not available' && (
                <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-[#D97706] opacity-60"></span>
              )}
              <span className="material-symbols-outlined text-[#B45309] text-[18px] relative">
                satellite_alt
              </span>
            </div>
            <span className="text-[12px] sm:text-[13px] text-[#1C1814] font-semibold">
              Radar: {location.radarStation}
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#E5DCCF]"></span>
            <span className="text-[11px] text-[#6E645A] font-medium">
              Convective cell: {location.convectiveCell}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};
