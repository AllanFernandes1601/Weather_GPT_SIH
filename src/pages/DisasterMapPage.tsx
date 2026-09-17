import React, { useEffect, useMemo, useState } from 'react';
import { DisasterMap, DisasterMapLayer } from '../components/DisasterMap';
import { HourlyForecastItem, LocationData } from '../types';
import { DistrictFloodContext, riskService } from '../services/riskService';
import { nationalWeatherService, NationalWeatherGrid } from '../services/nationalWeatherService';
import { calculateRiskFromInputs, RiskAssessment } from '../utils/riskEngine';

interface DisasterMapPageProps {
  location: LocationData;
  hourlyForecast: HourlyForecastItem[];
  onBackToHome: () => void;
}

const layers: Array<{ id: DisasterMapLayer; label: string; icon: string; description: string }> = [
  { id: 'overview', label: 'All risks', icon: 'layers', description: 'Combined signals' },
  { id: 'rain', label: 'Rain', icon: 'rainy', description: 'Forecast rainfall' },
  { id: 'flood', label: 'Flood', icon: 'flood', description: 'Rain × DFSI' },
  { id: 'heat', label: 'Heat', icon: 'device_thermostat', description: 'Heat stress' },
  { id: 'aqi', label: 'Air quality', icon: 'airwave', description: 'US AQI layer' },
  { id: 'cyclone', label: 'Cyclone', icon: 'cyclone', description: 'Historical track' }
];

const levelStyles: Record<string, string> = {
  Low: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  Moderate: 'text-amber-800 bg-amber-50 border-amber-200',
  High: 'text-orange-800 bg-orange-50 border-orange-200',
  Severe: 'text-red-800 bg-red-50 border-red-200',
  Unavailable: 'text-slate-600 bg-slate-50 border-slate-200'
};

export const DisasterMapPage: React.FC<DisasterMapPageProps> = ({ location, hourlyForecast, onBackToHome }) => {
  const [activeLayer, setActiveLayer] = useState<DisasterMapLayer>('overview');
  const [selectedHour, setSelectedHour] = useState(0);
  const [selectedLocationId, setSelectedLocationId] = useState(location.id);
  const [floodContext, setFloodContext] = useState<DistrictFloodContext | null>(null);
  const [loadingFlood, setLoadingFlood] = useState(false);
  const [nationalGrid, setNationalGrid] = useState<NationalWeatherGrid | null>(null);
  const [gridStatus, setGridStatus] = useState<'loading' | 'live' | 'fallback'>('loading');

  useEffect(() => {
    const controller = new AbortController();
    setGridStatus('loading');
    nationalWeatherService.getGrid(controller.signal)
      .then(grid => {
        setNationalGrid(grid);
        setGridStatus(grid.stations.length > 0 ? 'live' : 'fallback');
      })
      .catch(error => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        console.warn('[Nationwide Map Notice]: Live grid unavailable; keeping local stations.', error);
        setNationalGrid(null);
        setGridStatus('fallback');
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    setSelectedLocationId(location.id);
    let cancelled = false;
    setLoadingFlood(true);
    setFloodContext(null);
    riskService.getDistrictFloodContext(location)
      .then(context => { if (!cancelled) setFloodContext(context); })
      .finally(() => { if (!cancelled) setLoadingFlood(false); });
    return () => { cancelled = true; };
  }, [location]);

  const riskSet = useMemo(
    () => calculateRiskFromInputs(riskService.toLiveInputs(location, floodContext)),
    [location, floodContext]
  );
  const visibleForecast = hourlyForecast.slice(0, 12);
  const selectedForecast = visibleForecast[selectedHour] ?? visibleForecast[0];
  const assessments = Object.values(riskSet.assessments) as RiskAssessment[];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <section className="relative overflow-hidden rounded-3xl border border-[#E5DCCF]/70 bg-gradient-to-br from-[#FFFDF9] via-[#F4F8FA] to-[#E7F1F3] p-6 shadow-sm sm:p-8">
        <div className="absolute -right-14 -top-20 h-64 w-64 rounded-full bg-cyan-200/30 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#0E7490] to-cyan-400 text-white shadow-lg shadow-cyan-800/20">
              <span className="material-symbols-outlined text-[28px]">public</span>
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[25px] font-bold tracking-tight text-[#1C1814] sm:text-[30px]">Disaster Intelligence Map</h2>
                <span className="rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-cyan-800">Spatial beta</span>
                <span className="rounded-full border border-[#E5DCCF] bg-white/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#6E645A]">3D terrain</span>
                <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${gridStatus === 'live' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : gridStatus === 'loading' ? 'border-cyan-200 bg-cyan-50 text-cyan-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
                  {gridStatus === 'live' ? `${nationalGrid?.stations.length ?? 0} live India points` : gridStatus === 'loading' ? 'Loading India grid' : 'Local fallback'}
                </span>
              </div>
              <p className="mt-1 max-w-3xl text-[13px] text-[#6E645A] sm:text-[15px]">
                Apple Weather–inspired situational awareness using the same explainable risk engine as the Risks page.
              </p>
            </div>
          </div>
          <button type="button" onClick={onBackToHome} className="flex self-start items-center gap-2 rounded-full border border-[#E5DCCF] bg-white px-5 py-2.5 text-[13px] font-semibold text-[#1C1814] shadow-sm transition hover:bg-[#F5F0E8] lg:self-auto">
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Back to Live Home
          </button>
        </div>

        <div className="relative mt-6 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {layers.map(layer => (
            <button
              key={layer.id}
              type="button"
              onClick={() => setActiveLayer(layer.id)}
              className={`flex shrink-0 items-center gap-2 rounded-2xl border px-3.5 py-2.5 text-left transition ${activeLayer === layer.id ? 'border-cyan-600 bg-[#0E7490] text-white shadow-md' : 'border-[#E5DCCF] bg-white/80 text-[#1C1814] hover:bg-white'}`}
            >
              <span className="material-symbols-outlined text-[19px]">{layer.icon}</span>
              <span><span className="block text-[12px] font-bold">{layer.label}</span><span className={`block text-[9px] ${activeLayer === layer.id ? 'text-cyan-100' : 'text-[#8E7965]'}`}>{layer.description}</span></span>
            </button>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <DisasterMap
          location={location}
          hourlyForecast={visibleForecast}
          floodContext={floodContext}
          layer={activeLayer}
          selectedHour={selectedHour}
          selectedLocationId={selectedLocationId}
          nationalStations={nationalGrid?.stations ?? []}
          onSelectLocation={setSelectedLocationId}
        />

        <aside className="space-y-4">
          <div className="rounded-3xl border border-[#E5DCCF]/80 bg-[#FFFDF9] p-5 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#B45309]">Current location assessment</p>
            <h3 className="mt-1 text-[19px] font-bold text-[#1C1814]">{location.name}, {location.state}</h3>
            <div className="mt-4 space-y-2.5">
              {assessments.map(assessment => (
                <button key={assessment.kind} type="button" onClick={() => setActiveLayer(assessment.kind === 'wind' ? 'overview' : assessment.kind)} className="flex w-full items-center justify-between gap-3 rounded-2xl border border-[#E5DCCF]/70 bg-[#F8F4EE] p-3 text-left transition hover:border-[#0E7490]/40">
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span className="material-symbols-outlined text-[20px] text-[#0E7490]">{assessment.icon}</span>
                    <span className="min-w-0"><span className="block truncate text-[12px] font-bold text-[#1C1814]">{assessment.title}</span><span className="block truncate text-[10px] text-[#6E645A]">{assessment.displayValue}</span></span>
                  </span>
                  <span className={`rounded-full border px-2 py-1 text-[9px] font-bold ${levelStyles[assessment.level]}`}>{assessment.level}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-[#E5DCCF]/80 bg-[#FFFDF9] p-5 shadow-sm">
            <div className="flex items-center gap-2"><span className="material-symbols-outlined text-[20px] text-[#B45309]">verified_user</span><h3 className="text-[15px] font-bold text-[#1C1814]">Trust &amp; provenance</h3></div>
            <div className="mt-3 space-y-3 text-[11px] leading-relaxed text-[#6E645A]">
              <p><strong className="text-[#1C1814]">Live:</strong> {location.isLive ? 'Open-Meteo weather and air-quality inputs are active.' : 'Live API unavailable; fallback station inputs are shown.'}</p>
              <p><strong className="text-[#1C1814]">India coverage:</strong> {gridStatus === 'live' ? `${nationalGrid?.stations.length ?? 0} representative locations are loaded from batched weather and AQI forecasts.` : gridStatus === 'loading' ? 'Loading nationwide forecast points…' : 'Nationwide feed is unavailable; only existing local stations are displayed.'}</p>
              <p><strong className="text-[#1C1814]">Flood:</strong> {loadingFlood ? 'Matching district DFSI…' : floodContext ? `Estimated from rainfall and ${floodContext.district} DFSI.` : 'No unambiguous district DFSI match; no value invented.'}</p>
              <p><strong className="text-[#1C1814]">Cyclone:</strong> Historical track visualization only. No live cyclone warning feed is connected.</p>
            </div>
          </div>
        </aside>
      </section>

      <section className="rounded-3xl border border-[#E5DCCF]/80 bg-[#FFFDF9] p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#B45309]">Forecast timeline</p><h3 className="text-[17px] font-bold text-[#1C1814]">Explore the next 12 hours</h3></div>
          <p className="text-[11px] text-[#6E645A]">{selectedForecast ? `${selectedForecast.time} · ${selectedForecast.temperature}° · ${selectedForecast.rainProbability}% rain` : 'Forecast unavailable'}</p>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          {visibleForecast.map((item, index) => (
            <button key={`${item.forecastTime ?? item.time}-${index}`} type="button" onClick={() => setSelectedHour(index)} className={`min-w-[92px] rounded-2xl border px-3 py-3 text-center transition ${selectedHour === index ? 'border-cyan-600 bg-[#0E7490] text-white shadow-md' : 'border-[#E5DCCF] bg-[#F8F4EE] text-[#1C1814] hover:border-cyan-300'}`}>
              <span className="block text-[10px] font-bold">{item.time}</span>
              <span className="material-symbols-outlined my-1 block text-[22px]">{item.icon}</span>
              <span className="block text-[13px] font-bold">{item.temperature}°</span>
              <span className={`mt-1 block text-[9px] ${selectedHour === index ? 'text-cyan-100' : 'text-blue-600'}`}>{item.rainProbability}% rain</span>
            </button>
          ))}
        </div>
        <p className="mt-3 border-t border-[#E5DCCF]/70 pt-3 text-[10px] text-[#8E7965]">Timeline changes forecast context and precipitation animation intensity. Risk categories remain calculated by the shared WeatherGPT risk engine—not by visual animation.</p>
      </section>
    </div>
  );
};
