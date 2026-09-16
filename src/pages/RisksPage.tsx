import React, { useEffect, useMemo, useState } from 'react';
import { RiskCard } from '../components/RiskCard';
import { RiskWeatherCanvas } from '../components/RiskWeatherCanvas';
import { riskService, DistrictFloodContext } from '../services/riskService';
import { LocationData } from '../types';
import {
  calculateRiskFromInputs,
  calculateRiskGaugeSnapshot,
  DFSI_DATASET_MAX,
  DFSI_DATASET_MIN,
  RiskAssessment,
  RiskInputs,
  RiskKind,
  RiskLevel
} from '../utils/riskEngine';

interface RisksPageProps {
  location: LocationData;
  onBackToHome: () => void;
}

interface SimulatorValues {
  rainMm24h: number;
  temperatureC: number;
  humidityPercent: number;
  windGustKmh: number;
  aqi: number;
  dfsiNormalized: number;
}

const affectedRisks: Record<keyof SimulatorValues, RiskKind[]> = {
  rainMm24h: ['rain', 'flood'],
  temperatureC: ['heat'],
  humidityPercent: ['heat'],
  windGustKmh: ['wind'],
  aqi: ['aqi'],
  dfsiNormalized: ['flood']
};

const alertStyles: Record<RiskLevel, string> = {
  Low: 'bg-emerald-50 border-emerald-200 text-emerald-950',
  Moderate: 'bg-amber-50 border-amber-200 text-amber-950',
  High: 'bg-orange-50 border-orange-200 text-orange-950',
  Severe: 'bg-red-50 border-red-200 text-red-950',
  Unavailable: 'bg-stone-100 border-stone-200 text-stone-800'
};

const sliderFields: Array<{
  key: keyof SimulatorValues;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
  icon: string;
}> = [
  { key: 'rainMm24h', label: '24-hour rainfall', min: 0, max: 250, step: 1, unit: 'mm', icon: 'rainy' },
  { key: 'temperatureC', label: 'Maximum temperature', min: 15, max: 50, step: 1, unit: '°C', icon: 'device_thermostat' },
  { key: 'humidityPercent', label: 'Relative humidity', min: 10, max: 100, step: 1, unit: '%', icon: 'humidity_percentage' },
  { key: 'windGustKmh', label: 'Wind gust', min: 0, max: 140, step: 1, unit: 'km/h', icon: 'air' },
  { key: 'aqi', label: 'US AQI', min: 0, max: 500, step: 5, unit: '', icon: 'airwave' },
  { key: 'dfsiNormalized', label: 'District flood susceptibility', min: 0, max: 1, step: 0.01, unit: '', icon: 'flood' }
];

function simulatorFromLive(inputs: RiskInputs): SimulatorValues {
  return {
    rainMm24h: Math.round(inputs.rainMm24h),
    temperatureC: Math.round(Math.max(inputs.maxTemperatureC, inputs.apparentTemperatureC)),
    humidityPercent: Math.round(inputs.humidityPercent),
    windGustKmh: Math.round(inputs.windGustKmh),
    aqi: Math.round(inputs.aqi ?? 50),
    dfsiNormalized: inputs.dfsiNormalized ?? 0.5
  };
}

export const RisksPage: React.FC<RisksPageProps> = ({ location, onBackToHome }) => {
  const [mode, setMode] = useState<'live' | 'simulation'>('live');
  const [floodContext, setFloodContext] = useState<DistrictFloodContext | null>(null);
  const [isLoadingFloodContext, setIsLoadingFloodContext] = useState(false);

  const liveInputs = useMemo(
    () => riskService.toLiveInputs(location, floodContext),
    [location, floodContext]
  );
  const [simulator, setSimulator] = useState<SimulatorValues>(() => simulatorFromLive(liveInputs));
  const [debouncedSimulator, setDebouncedSimulator] = useState<SimulatorValues>(() => simulatorFromLive(liveInputs));
  const [pulse, setPulse] = useState<{ field: keyof SimulatorValues; token: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoadingFloodContext(true);
    setFloodContext(null);
    riskService.getDistrictFloodContext(location)
      .then(context => {
        if (!cancelled) setFloodContext(context);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingFloodContext(false);
      });
    return () => {
      cancelled = true;
    };
  }, [location.id, location.name, location.state]);

  useEffect(() => {
    if (mode === 'live') {
      const next = simulatorFromLive(liveInputs);
      setSimulator(next);
      setDebouncedSimulator(next);
    }
  }, [liveInputs, mode]);

  useEffect(() => {
    if (mode !== 'simulation') return;
    const timeout = window.setTimeout(() => setDebouncedSimulator(simulator), 100);
    return () => window.clearTimeout(timeout);
  }, [simulator, mode]);

  const simulationInputs = useMemo<RiskInputs>(() => {
    const dfsiRaw = DFSI_DATASET_MIN + debouncedSimulator.dfsiNormalized * (DFSI_DATASET_MAX - DFSI_DATASET_MIN);
    return {
      rainMm24h: debouncedSimulator.rainMm24h,
      maxTemperatureC: debouncedSimulator.temperatureC,
      apparentTemperatureC: debouncedSimulator.temperatureC,
      humidityPercent: debouncedSimulator.humidityPercent,
      windGustKmh: debouncedSimulator.windGustKmh,
      aqi: debouncedSimulator.aqi,
      aqiScale: 'us',
      dfsiNormalized: debouncedSimulator.dfsiNormalized,
      dfsiRaw,
      rainMlProbability: null,
      rainMlWillRain: null,
      useBengaluruMl: false,
      sourceLabel: 'Scenario Simulator inputs',
      updatedAt: new Date().toISOString()
    };
  }, [debouncedSimulator]);

  const instantSimulationInputs = useMemo<RiskInputs>(() => ({
    ...simulationInputs,
    rainMm24h: simulator.rainMm24h,
    maxTemperatureC: simulator.temperatureC,
    apparentTemperatureC: simulator.temperatureC,
    humidityPercent: simulator.humidityPercent,
    windGustKmh: simulator.windGustKmh,
    aqi: simulator.aqi,
    dfsiNormalized: simulator.dfsiNormalized,
    dfsiRaw: DFSI_DATASET_MIN + simulator.dfsiNormalized * (DFSI_DATASET_MAX - DFSI_DATASET_MIN)
  }), [simulationInputs, simulator]);

  const instantGaugeSnapshot = useMemo(
    () => calculateRiskGaugeSnapshot(mode === 'live' ? liveInputs : instantSimulationInputs),
    [mode, liveInputs, instantSimulationInputs]
  );

  const result = useMemo(
    () => calculateRiskFromInputs(mode === 'live' ? liveInputs : simulationInputs),
    [mode, liveInputs, simulationInputs]
  );
  const highest = result.highestAvailableRisk;

  return (
    <div className="space-y-7 animate-in fade-in duration-200">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#FFFDF9] via-[#FAF3E8] to-[#F3E5D4] border border-[#E5DCCF]/80 shadow-sm p-6 sm:p-8">
        <div className="absolute -right-16 -top-20 w-72 h-72 rounded-full bg-amber-200/30 blur-3xl" />
        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 shrink-0 rounded-2xl bg-gradient-to-tr from-[#B45309] to-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-700/20">
              <span className="material-symbols-outlined text-[28px]">crisis_alert</span>
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[24px] sm:text-[30px] font-bold text-[#1C1814] tracking-tight">Risk Intelligence</h2>
                <span className="text-[10px] uppercase tracking-wider font-bold text-[#7C2D12] bg-amber-100 border border-amber-200 rounded-full px-2.5 py-1">
                  Explainable engine
                </span>
              </div>
              <p className="text-[13px] sm:text-[15px] text-[#6E645A] mt-1 max-w-3xl">
                Live forecast signals, Bengaluru ML output and district flood susceptibility for {location.name}, {location.state}.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onBackToHome}
            className="self-start lg:self-auto px-5 py-2.5 rounded-full bg-white hover:bg-[#F5F0E8] text-[#1C1814] border border-[#E5DCCF] font-semibold text-[13px] shadow-sm transition-all flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Back to Live Home
          </button>
        </div>

        <div className={`relative mt-6 inline-flex p-1 rounded-2xl bg-white/80 border border-[#E5DCCF] shadow-sm ${mode === 'live' ? 'risk-live-badge' : ''}`}>
          <button
            type="button"
            onClick={() => setMode('live')}
            className={`px-4 py-2 rounded-xl text-[12px] font-bold transition-all ${mode === 'live' ? 'bg-[#D97706] text-white shadow-sm' : 'text-[#6E645A] hover:text-[#1C1814]'}`}
          >
            Live Risk Engine
          </button>
          <button
            type="button"
            onClick={() => setMode('simulation')}
            className={`px-4 py-2 rounded-xl text-[12px] font-bold transition-all ${mode === 'simulation' ? 'bg-[#D97706] text-white shadow-sm' : 'text-[#6E645A] hover:text-[#1C1814]'}`}
          >
            Scenario Simulator
          </button>
        </div>
      </section>

      <section className={`rounded-3xl border p-5 sm:p-6 ${alertStyles[highest.level]}`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-[26px]">warning</span>
            <div>
              <p className="text-[11px] uppercase tracking-wider font-bold">
                {mode === 'live' ? 'Current WeatherGPT advisory' : 'Simulated advisory'} · {highest.level}
              </p>
              <h3 className="text-[18px] font-bold mt-1">Highest signal: {highest.title}</h3>
              <p className="text-[13px] mt-1 opacity-80">{highest.reason}</p>
            </div>
          </div>
          <div className="shrink-0 text-[11px] font-semibold bg-white/70 border border-current/10 rounded-full px-3 py-1.5">
            {mode === 'live' ? (location.isLive ? 'Live inputs' : 'Fallback inputs') : 'Simulation—not a forecast'}
          </div>
        </div>
        <p className="text-[11px] mt-4 pt-3 border-t border-current/10 opacity-75">
          WeatherGPT preparedness advisory—not an official government warning. Follow IMD and local-authority instructions for urgent decisions.
        </p>
      </section>

      {mode === 'simulation' && (
        <section className="rounded-3xl bg-[#FFFDF9] border border-[#E5DCCF]/80 shadow-sm p-5 sm:p-7">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <div>
              <h3 className="text-[20px] font-bold text-[#1C1814]">Scenario controls</h3>
              <p className="text-[12px] text-[#6E645A] mt-1">These sliders override live inputs and call the exact same risk functions.</p>
            </div>
            <button
              type="button"
              onClick={() => setSimulator(simulatorFromLive(liveInputs))}
              className="px-4 py-2 rounded-full text-[12px] font-semibold text-[#B45309] bg-amber-50 hover:bg-amber-100 border border-amber-200"
            >
              Reset to live inputs
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {sliderFields.map(field => {
              const value = simulator[field.key];
              const display = field.key === 'dfsiNormalized' ? `${Math.round(value * 100)}% relative` : `${value}${field.unit}`;
              return (
                <label
                  key={field.key}
                  className={`rounded-2xl bg-[#F7F1E8] border border-[#E9DDCC] p-4 ${pulse?.field === field.key ? 'risk-slider-pulse' : ''}`}
                >
                  <span className="flex items-center justify-between gap-2 text-[12px] font-semibold text-[#1C1814]">
                    <span className="inline-flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px] text-[#B45309]">{field.icon}</span>
                      {field.label}
                    </span>
                    <span className="text-[#B45309] font-bold">{display}</span>
                  </span>
                  <input
                    type="range"
                    min={field.min}
                    max={field.max}
                    step={field.step}
                    value={value}
                    onInput={event => {
                      const nextValue = Number(event.currentTarget.value);
                      setSimulator(current => ({ ...current, [field.key]: nextValue }));
                      setPulse({ field: field.key, token: Date.now() });
                    }}
                    className="w-full mt-4 accent-[#D97706]"
                  />
                </label>
              );
            })}
          </div>
        </section>
      )}

      <RiskWeatherCanvas inputs={mode === 'live' ? liveInputs : instantSimulationInputs} />

      <section>
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 mb-4">
          <div>
            <h3 className="text-[20px] sm:text-[22px] font-bold text-[#1C1814]">Five-signal assessment</h3>
            <p className="text-[12px] text-[#6E645A] mt-1">Every card exposes its method, source, limitation and recommended action.</p>
            <p className="text-[11px] text-[#8E7965] mt-1">Categorical height compares risk bands—not probabilities.</p>
          </div>
          <div className="flex flex-col sm:items-end gap-2">
            <span className="text-[11px] text-[#6E645A]">
              {isLoadingFloodContext
                ? 'Loading district DFSI…'
                : floodContext
                  ? `DFSI matched: ${floodContext.district}, ${floodContext.state}`
                  : 'No unambiguous district DFSI match'}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {(Object.values(result.assessments) as RiskAssessment[]).map(assessment => (
            <RiskCard
              key={assessment.kind}
              assessment={assessment}
              gaugeValue={instantGaugeSnapshot.values[assessment.kind]}
              floodContributions={assessment.kind === 'flood' ? instantGaugeSnapshot.floodContributions : undefined}
              isLive={mode === 'live'}
              isHighest={assessment.kind === highest.kind}
              pulseToken={mode === 'simulation' && pulse && affectedRisks[pulse.field].includes(assessment.kind) ? pulse.token : undefined}
            />
          ))}
        </div>
      </section>

      <section className="rounded-3xl bg-[#1C1814] text-white p-5 sm:p-7 border border-black/10 shadow-sm">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div>
            <p className="text-[11px] uppercase tracking-wider font-bold text-amber-300">Trust model</p>
            <h3 className="text-[20px] font-bold mt-1">Prediction, rules and evidence stay separate.</h3>
          </div>
          <p className="text-[12px] leading-relaxed text-stone-300">
            Bengaluru rain may show an ML probability. Other rain, heat, wind and AQI results use transparent forecast rules. Flood is a susceptibility estimate using dataset-relative DFSI.
          </p>
          <p className="text-[12px] leading-relaxed text-stone-300">
            Gemini is not required for these calculations. It can explain the result when quota is available, but the engine and reasons remain functional without it.
          </p>
        </div>
      </section>
    </div>
  );
};
