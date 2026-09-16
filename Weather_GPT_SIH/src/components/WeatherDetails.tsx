import React from 'react';
import { LocationData } from '../types';

interface WeatherDetailsProps {
  location: LocationData;
}

export const WeatherDetails: React.FC<WeatherDetailsProps> = ({ location }) => {
  return (
    <section id="detailed-weather-metrics" className="space-y-4">
      <div>
        <h3 className="text-[20px] sm:text-[22px] font-bold text-[#1C1814]">
          Detailed Weather Metrics
        </h3>
        <p className="text-[13px] text-[#6E645A]">
          Micro-meteorology and environmental telemetry for {location.name} Urban
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Card 1: Air Quality (AQI) */}
        <div className="interactive-card p-5 sm:p-6 rounded-3xl bg-[#FFFDF9] border border-[#E5DCCF]/70 shadow-sm flex flex-col justify-between space-y-4 cursor-default">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#B45309] text-[20px]">
                air
              </span>
              <span className="text-[11px] uppercase font-bold text-[#6E645A] tracking-wider">
                Air Quality Index
              </span>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/60 text-[11px] font-bold transition-transform hover:scale-105">
              {location.airQuality.status}
            </span>
          </div>

          <div>
            <div className="flex items-baseline gap-3">
              <span className="text-[32px] sm:text-[36px] font-bold text-[#1C1814] leading-tight font-sans">
                {location.airQuality.aqi}
              </span>
              <span className="text-[13px] text-[#6E645A] font-medium">
                AQI • Atmospheric Quality Index
              </span>
            </div>
            <p className="text-[13px] text-[#6E645A] mt-1">
              {location.airQuality.description}
            </p>
          </div>

          <div className="space-y-2">
            <div className="w-full h-2 rounded-full bg-gradient-to-r from-emerald-500 via-yellow-400 to-red-500 relative">
              <div
                className="absolute -top-1 w-4 h-4 rounded-full bg-white shadow-md border-2 border-emerald-600 transition-transform duration-300 hover:scale-125 cursor-pointer"
                style={{ left: `${Math.min(location.airQuality.aqi / 2.5, 95)}%` }}
                title={`Current: ${location.airQuality.aqi} AQI`}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-[#6E645A] pt-1">
              <span>
                PM2.5: <strong className="text-[#1C1814]">{location.airQuality.pm25} µg/m³</strong>
              </span>
              <span>
                PM10: <strong className="text-[#1C1814]">{location.airQuality.pm10} µg/m³</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: UV Index */}
        <div className="interactive-card p-5 sm:p-6 rounded-3xl bg-[#FFFDF9] border border-[#E5DCCF]/70 shadow-sm flex flex-col justify-between space-y-4 cursor-default">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#EA580C] text-[20px]">
                wb_sunny
              </span>
              <span className="text-[11px] uppercase font-bold text-[#6E645A] tracking-wider">
                UV Radiation Index
              </span>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200/80 text-[11px] font-bold transition-transform hover:scale-105">
              Level {location.uvIndex}
            </span>
          </div>

          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-[32px] sm:text-[36px] font-bold text-[#1C1814] leading-tight font-sans">
                {location.uvIndex}
              </span>
              <span className="text-[18px] text-[#C2410C] font-semibold">
                {location.uvCategory}
              </span>
            </div>
            <p className="text-[13px] text-[#6E645A] mt-1">
              Peak intensity expected between 11:30 AM – 2:00 PM.
            </p>
          </div>

          <div className="p-3 rounded-2xl bg-[#F5F0E8] border border-[#E5DCCF]/50 space-y-1">
            <div className="flex items-center gap-2 text-[12px] text-[#1C1814] font-medium">
              <span className="material-symbols-outlined text-[16px] text-[#B45309]">
                check_circle
              </span>
              <span>Wear sunglasses on bright spells; sun protection advised.</span>
            </div>
          </div>
        </div>

        {/* Card 3: Wind & Gusts with Interactive Needle Wobble */}
        <div className="interactive-card compass-group p-5 sm:p-6 rounded-3xl bg-[#FFFDF9] border border-[#E5DCCF]/70 shadow-sm flex flex-col justify-between space-y-4 cursor-default">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#B45309] text-[20px]">
                north_west
              </span>
              <span className="text-[11px] uppercase font-bold text-[#6E645A] tracking-wider">
                Wind &amp; Gusts
              </span>
            </div>
            <span className="text-[11px] text-[#6E645A] font-semibold bg-[#F5F0E8] px-2 py-0.5 rounded-full">
              {location.windDirection} Direction
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-[32px] sm:text-[36px] font-bold text-[#1C1814] leading-tight font-sans">
                  {location.windSpeed}
                </span>
                <span className="text-[14px] text-[#6E645A] font-medium">km/h</span>
              </div>
              <p className="text-[13px] text-[#6E645A] mt-1">
                Convective gusts peaking at <strong className="text-[#1C1814]">{location.windGusts} km/h</strong>
              </p>
            </div>

            {/* Compass SVG Graphic */}
            <div className="relative w-16 h-16 flex items-center justify-center cursor-pointer" title={`Compass: ${location.windDirection} Winds`}>
              <svg className="w-16 h-16 transition-transform duration-300 group-hover:scale-105" fill="none" viewBox="0 0 64 64">
                <circle className="text-[#E2D5BE]" cx="32" cy="32" r="30" stroke="currentColor" strokeWidth="1.5" />
                <path className="text-[#E5DCCF]" d="M32 6 L32 10 M32 54 L32 58 M6 32 L10 32 M54 32 L58 32" stroke="currentColor" strokeWidth="1.5" />
                <g className="compass-needle transition-transform duration-300">
                  <polygon className="text-[#D97706]" fill="currentColor" points="32,32 20,20 28,18" />
                  <polygon className="text-[#A3998E]" fill="currentColor" points="32,32 44,44 36,46" />
                  <circle className="text-[#1C1814]" cx="32" cy="32" fill="currentColor" r="3" />
                </g>
              </svg>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-[#6E645A] bg-[#F5F0E8] border border-[#E5DCCF]/50 px-3 py-2 rounded-xl">
            <span>Air movement: Light breeze</span>
            <span className="text-[#B45309] font-bold">Dry continental shear</span>
          </div>
        </div>

        {/* Card 4: Sun & Moon Cycle with Pulsing Solar Marker */}
        <div className="interactive-card p-5 sm:p-6 rounded-3xl bg-[#FFFDF9] border border-[#E5DCCF]/70 shadow-sm flex flex-col justify-between space-y-4 cursor-default">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-amber-500 text-[20px]">
                routine
              </span>
              <span className="text-[11px] uppercase font-bold text-[#6E645A] tracking-wider">
                Solar &amp; Daylight Cycle
              </span>
            </div>
            <span className="text-[11px] text-[#6E645A] font-semibold bg-[#F5F0E8] px-2 py-0.5 rounded-full">
              {location.solarCycle.daylightDuration}
            </span>
          </div>

          {/* Solar Arc SVG with pulsing sun tracking marker */}
          <div className="relative w-full h-20 flex items-center justify-center">
            <svg className="w-full h-full" fill="none" viewBox="0 0 260 80">
              <line className="text-[#E5DCCF]" stroke="currentColor" strokeDasharray="2 2" strokeWidth="1.5" x1="10" x2="250" y1="70" y2="70" />
              <path className="text-amber-200" d="M20 70 Q130 0 240 70" stroke="currentColor" strokeWidth="2" />
              <g className="solar-marker-pulse">
                <circle className="text-amber-500 shadow-lg" cx="165" cy="24" fill="currentColor" r="7" />
                <circle className="text-amber-300 opacity-60" cx="165" cy="24" r="12" stroke="currentColor" strokeWidth="1.5" />
              </g>
            </svg>
          </div>

          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="p-2.5 rounded-2xl bg-[#F5F0E8] border border-[#E5DCCF]/50 hover:bg-[#EFE7DB] transition-colors">
              <span className="text-[11px] text-[#6E645A]">Sunrise</span>
              <p className="text-[16px] font-bold text-[#1C1814]">
                {location.solarCycle.sunrise}
              </p>
            </div>
            <div className="p-2.5 rounded-2xl bg-[#F5F0E8] border border-[#E5DCCF]/50 hover:bg-[#EFE7DB] transition-colors">
              <span className="text-[11px] text-[#6E645A]">Sunset</span>
              <p className="text-[16px] font-bold text-[#1C1814]">
                {location.solarCycle.sunset}
              </p>
            </div>
          </div>
        </div>

        {/* Card 5: Precipitation & Dew */}
        <div className="interactive-card p-5 sm:p-6 rounded-3xl bg-[#FFFDF9] border border-[#E5DCCF]/70 shadow-sm flex flex-col justify-between space-y-4 cursor-default">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#D97706] text-[20px]">
                water_drop
              </span>
              <span className="text-[11px] uppercase font-bold text-[#6E645A] tracking-wider">
                Precipitation &amp; Dew
              </span>
            </div>
            <span className="text-[11px] text-[#B45309] font-bold bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
              {location.precipitation.dailyTotalMm} mm Today
            </span>
          </div>

          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-[32px] sm:text-[36px] font-bold text-[#1C1814] leading-tight font-sans">
                {location.precipitation.dewPoint}°C
              </span>
              <span className="text-[13px] text-[#6E645A] font-medium">Dew Point</span>
            </div>
            <p className="text-[13px] text-[#6E645A] mt-1">
              {location.precipitation.description}
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] text-[#6E645A]">
              <span>Monsoon Moisture Flux</span>
              <span className={`font-bold ${location.precipitation.moistureFlux !== undefined ? 'text-[#B45309]' : 'text-[#8C827A]'}`}>
                {location.precipitation.moistureFlux !== undefined
                  ? `${location.precipitation.moistureFlux}% High`
                  : 'Not available'}
              </span>
            </div>
            {location.precipitation.moistureFlux !== undefined ? (
              <div className="w-full h-2 rounded-full bg-[#F2EBE1] overflow-hidden">
                <div
                  className="h-full bg-[#D97706] rounded-full transition-all duration-500 hover:brightness-110"
                  style={{ width: `${location.precipitation.moistureFlux}%` }}
                />
              </div>
            ) : (
              <p className="text-[11px] text-[#8C827A]">
                Sensor metric not provided by Open-Meteo grid
              </p>
            )}
          </div>
        </div>

        {/* Card 6: Atmospheric Pressure & Isobars */}
        <div className="interactive-card p-5 sm:p-6 rounded-3xl bg-[#FFFDF9] border border-[#E5DCCF]/70 shadow-sm flex flex-col justify-between space-y-4 cursor-default">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#B45309] text-[20px]">
                compress
              </span>
              <span className="text-[11px] uppercase font-bold text-[#6E645A] tracking-wider">
                Barometric Pressure
              </span>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-[#F2EBE1] text-[#6E645A] text-[11px] font-medium">
              Standard
            </span>
          </div>

          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-[32px] sm:text-[36px] font-bold text-[#1C1814] leading-tight font-sans">
                {location.pressure}
              </span>
              <span className="text-[13px] text-[#6E645A] font-medium">hPa</span>
            </div>
            <p className="text-[13px] text-[#6E645A] mt-1">
              Pressure gradient steady across Deccan Plateau.
            </p>
          </div>

          <div className="p-3 rounded-2xl bg-[#F5F0E8] border border-[#E5DCCF]/50 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[11px] text-[#6E645A]">12-Hour Gradient</span>
              <p className="text-[12px] font-bold text-[#1C1814]">
                No Sudden Depressions
              </p>
            </div>
            <svg className="w-24 h-8 transition-transform duration-300 hover:scale-105 cursor-pointer" fill="none" viewBox="0 0 100 30">
              <path className="text-[#B45309]" d="M0 15 Q25 10 50 15 T100 14" stroke="currentColor" strokeWidth="2" />
              <circle className="text-[#D97706] animate-pulse" cx="100" cy="14" fill="currentColor" r="3" />
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
};
