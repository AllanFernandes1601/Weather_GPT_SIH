import { useMemo } from 'react';
import { HourlyForecastItem, LocationData } from '../types';

interface ForecastAnalyticsProps {
  location: LocationData;
  forecast: HourlyForecastItem[];
}

const chartWidth = 1000;
const chartHeight = 250;
const chartTop = 28;
const chartBottom = 190;

function dayLabel(date: string, index: number) {
  if (index === 0) return 'Today';
  return new Date(`${date}T12:00:00`).toLocaleDateString([], { weekday: 'short' });
}

function formatHour(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleTimeString([], { hour: 'numeric', hour12: true });
}

export function ForecastAnalytics({ location, forecast }: ForecastAnalyticsProps) {
  const next24 = forecast.slice(0, 24);
  const graph = useMemo(() => {
    const values = next24.map(item => item.temperature);
    const min = Math.min(...values, location.temperature) - 1;
    const max = Math.max(...values, location.temperature) + 1;
    const range = Math.max(1, max - min);
    const step = next24.length > 1 ? chartWidth / (next24.length - 1) : chartWidth;
    const points = next24.map((item, index) => ({
      x: index * step,
      y: chartBottom - ((item.temperature - min) / range) * (chartBottom - chartTop),
      item
    }));
    return { min, max, points, polyline: points.map(point => `${point.x},${point.y}`).join(' ') };
  }, [next24, location.temperature]);

  const days = useMemo(() => {
    const grouped = new Map<string, HourlyForecastItem[]>();
    forecast.forEach(item => {
      const date = item.forecastTime?.slice(0, 10);
      if (!date) return;
      const values = grouped.get(date) || [];
      values.push(item);
      grouped.set(date, values);
    });
    return Array.from(grouped.entries()).slice(0, 7).map(([date, values], index) => {
      const wettest = values.reduce((peak, item) => item.rainProbability > peak.rainProbability ? item : peak);
      return {
        date,
        label: dayLabel(date, index),
        high: Math.max(...values.map(item => item.temperature)),
        low: Math.min(...values.map(item => item.temperature)),
        rain: Math.max(...values.map(item => item.rainProbability)),
        precipitation: values.reduce((sum, item) => sum + (item.precipitationMm || 0), 0),
        condition: wettest.condition,
        icon: wettest.icon,
        wind: Math.max(...values.map(item => item.windGustsKmh || item.windSpeedKmh || 0))
      };
    });
  }, [forecast]);

  const peakRain = next24.reduce((peak, item) => item.rainProbability > peak.rainProbability ? item : peak, next24[0]);
  const peakWind = next24.reduce((peak, item) => (item.windGustsKmh || 0) > (peak.windGustsKmh || 0) ? item : peak, next24[0]);
  const totalRain = next24.reduce((sum, item) => sum + (item.precipitationMm || 0), 0);
  const latestTime = forecast[0]?.forecastTime;

  if (!next24.length) return null;

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Metric icon="thermostat" label="Current" value={`${location.temperature}°C`} detail={`Feels ${location.feelsLike}°`} tone="amber" />
        <Metric icon="rainy" label="24h rainfall" value={`${totalRain.toFixed(1)} mm`} detail={`Peak ${peakRain.rainProbability}% at ${formatHour(peakRain.forecastTime)}`} tone="blue" />
        <Metric icon="humidity_percentage" label="Humidity" value={`${location.humidity}%`} detail={location.humidityDesc} tone="cyan" />
        <Metric icon="air" label="Peak gust" value={`${Math.max(location.windGusts, peakWind.windGustsKmh || 0)} km/h`} detail={`${location.windDirection} current flow`} tone="stone" />
        <Metric icon="compress" label="Pressure" value={`${location.pressure} hPa`} detail={location.pressureTendency.replace('hPa • ', '')} tone="violet" />
        <Metric icon="visibility" label="Visibility" value={`${location.visibility} km`} detail={`AQI ${location.airQuality.aqi} · ${location.airQuality.status}`} tone="emerald" />
      </section>

      <section className="overflow-hidden rounded-3xl border border-[#E5DCCF]/70 bg-[#FFFDF9] shadow-sm">
        <div className="flex flex-col gap-3 border-b border-[#E5DCCF]/70 p-5 sm:flex-row sm:items-end sm:justify-between sm:p-7">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#B45309]">Next 24 hours</p>
            <h2 className="mt-1 text-[21px] font-bold text-[#1C1814]">Temperature and precipitation signal</h2>
            <p className="mt-1 text-[12px] text-[#6E645A]">Orange line: temperature · Blue columns: Open-Meteo rain probability</p>
          </div>
          <span className="w-fit rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-bold text-emerald-800">LIVE FORECAST INPUT</span>
        </div>
        <div className="overflow-x-auto px-4 pb-4 pt-5 sm:px-7">
          <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="min-w-[760px]" role="img" aria-label="Temperature line and rain probability chart for the next 24 hours">
            <defs>
              <linearGradient id="temperature-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.24" />
                <stop offset="100%" stopColor="#F59E0B" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[0, 1, 2, 3].map(row => {
              const y = chartTop + row * ((chartBottom - chartTop) / 3);
              return <line key={row} x1="0" x2={chartWidth} y1={y} y2={y} stroke="#D8CDBC" strokeOpacity="0.55" strokeDasharray="5 7" />;
            })}
            {graph.points.map(({ x, item }, index) => {
              const barHeight = (item.rainProbability / 100) * 92;
              return (
                <g key={item.forecastTime || index}>
                  <rect x={x - 12} y={chartBottom - barHeight} width="24" height={barHeight} rx="7" fill="#3B82F6" opacity="0.28" />
                  {index % 3 === 0 && <text x={x} y="232" textAnchor="middle" fontSize="18" fill="currentColor" className="text-[#7C6F63]">{formatHour(item.forecastTime)}</text>}
                </g>
              );
            })}
            <polygon points={`0,${chartBottom} ${graph.polyline} ${chartWidth},${chartBottom}`} fill="url(#temperature-fill)" />
            <polyline points={graph.polyline} fill="none" stroke="#D97706" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
            {graph.points.filter((_, index) => index % 3 === 0).map(({ x, y, item }, index) => (
              <g key={index}><circle cx={x} cy={y} r="7" fill="#FFFDF9" stroke="#D97706" strokeWidth="4" /><text x={x} y={y - 15} textAnchor="middle" fontSize="18" fontWeight="700" fill="currentColor" className="text-[#1C1814]">{item.temperature}°</text></g>
            ))}
            <text x="0" y="18" fontSize="17" fill="currentColor" className="text-[#8E7965]">{Math.round(graph.max)}°</text>
            <text x="0" y="207" fontSize="17" fill="currentColor" className="text-[#8E7965]">{Math.round(graph.min)}°</text>
          </svg>
        </div>
      </section>

      <section className="rounded-3xl border border-[#E5DCCF]/70 bg-[#FFFDF9] p-5 shadow-sm sm:p-7">
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#B45309]">Seven-day outlook</p><h2 className="mt-1 text-[21px] font-bold text-[#1C1814]">Daily weather trajectory</h2></div>
          <p className="text-[10px] italic text-[#8E7965]">Direct Open-Meteo values—not WeatherGPT ML probabilities.</p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
          {days.map(day => (
            <article key={day.date} className="rounded-2xl border border-[#E5DCCF]/70 bg-[#F8F4EE] p-4 text-center transition hover:-translate-y-1 hover:shadow-md">
              <p className="text-[12px] font-bold text-[#1C1814]">{day.label}</p>
              <span className="material-symbols-outlined my-3 text-[30px] text-amber-500">{day.icon}</span>
              <p className="text-[18px] font-black text-[#1C1814]">{day.high}° <span className="text-[13px] font-semibold text-[#8E7965]">/ {day.low}°</span></p>
              <p className="mt-2 truncate text-[10px] font-semibold text-[#6E645A]" title={day.condition}>{day.condition}</p>
              <div className="mt-3 space-y-1.5 border-t border-[#E5DCCF] pt-3 text-[10px] text-[#6E645A]"><p className="flex justify-between"><span>Rain chance</span><strong className="text-blue-700">{day.rain}%</strong></p><p className="flex justify-between"><span>Total rain</span><strong>{day.precipitation.toFixed(1)} mm</strong></p><p className="flex justify-between"><span>Peak gust</span><strong>{day.wind} km/h</strong></p></div>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-[#E5DCCF]/70 bg-[#FFFDF9] p-5 shadow-sm sm:p-7">
        <div className="mb-4"><p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#B45309]">Atmospheric timeline</p><h2 className="mt-1 text-[21px] font-bold text-[#1C1814]">Detailed next 12 hours</h2></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] border-collapse text-left text-[12px]">
            <thead><tr className="border-y border-[#E5DCCF] bg-[#F8F4EE] text-[#6E645A]"><th className="px-3 py-3">Time</th><th className="px-3 py-3">Conditions</th><th className="px-3 py-3">Temp / feels</th><th className="px-3 py-3">Rain</th><th className="px-3 py-3">Humidity</th><th className="px-3 py-3">Wind / gust</th><th className="px-3 py-3">Pressure</th><th className="px-3 py-3">Visibility</th></tr></thead>
            <tbody>{forecast.slice(0, 12).map((item, index) => <tr key={item.forecastTime || index} className="border-b border-[#E5DCCF]/60 text-[#4F463E]"><td className="px-3 py-3 font-bold text-[#1C1814]">{index === 0 ? 'Now' : formatHour(item.forecastTime)}</td><td className="px-3 py-3"><span className="material-symbols-outlined mr-1 align-middle text-[18px] text-amber-500">{item.icon}</span>{item.condition}</td><td className="px-3 py-3">{item.temperature}° / {item.apparentTemperature ?? item.temperature}°C</td><td className="px-3 py-3 font-semibold text-blue-700">{item.rainProbability}% · {item.precipitationMm ?? 0} mm</td><td className="px-3 py-3">{item.humidityPercent ?? '—'}%</td><td className="px-3 py-3">{item.windSpeedKmh ?? '—'} / {item.windGustsKmh ?? '—'} km/h</td><td className="px-3 py-3">{item.pressureHpa ?? '—'} hPa</td><td className="px-3 py-3">{item.visibilityKm ?? '—'} km</td></tr>)}</tbody>
          </table>
        </div>
        <p className="mt-4 text-right text-[10px] text-[#8E7965]">Source: Open-Meteo forecast API · Updated {latestTime ? new Date(latestTime).toLocaleString() : 'when live data loads'} · Not an official government warning</p>
      </section>
    </div>
  );
}

function Metric({ icon, label, value, detail, tone }: { icon: string; label: string; value: string; detail: string; tone: string }) {
  const colors: Record<string, string> = { amber: 'bg-amber-50 text-amber-900', blue: 'bg-blue-50 text-blue-900', cyan: 'bg-cyan-50 text-cyan-900', stone: 'bg-stone-100 text-stone-800', violet: 'bg-violet-50 text-violet-900', emerald: 'bg-emerald-50 text-emerald-900' };
  return <article className={`rounded-2xl border border-[#E5DCCF]/70 p-4 ${colors[tone] || colors.amber}`}><span className="material-symbols-outlined text-[23px]">{icon}</span><p className="mt-3 text-[9px] font-bold uppercase tracking-[0.13em] opacity-70">{label}</p><p className="mt-1 text-[21px] font-black leading-tight">{value}</p><p className="mt-1 truncate text-[10px] opacity-75" title={detail}>{detail}</p></article>;
}
