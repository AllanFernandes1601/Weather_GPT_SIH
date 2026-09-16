import { LocationData } from '../types';
import { normalizeDfsi, RiskInputs } from '../utils/riskEngine';

export interface DistrictFloodContext {
  district: string;
  state: string;
  dfsiRaw: number;
  dfsiNormalized: number;
  sourceFile?: string;
}

const CITY_DISTRICT_ALIASES: Record<string, { district: string; state?: string }> = {
  bengaluru: { district: 'Bangalore', state: 'Karnataka' },
  bangalore: { district: 'Bangalore', state: 'Karnataka' },
  'delhi ncr': { district: 'New Delhi', state: 'Delhi' },
  delhi: { district: 'New Delhi', state: 'Delhi' },
  kochi: { district: 'Ernakulam', state: 'Kerala' }
};

interface RagResponse {
  ok?: boolean;
  result?: any;
}

async function retrieve(payload: Record<string, unknown>): Promise<RagResponse | null> {
  try {
    const response = await fetch('/api/rag/retrieve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

async function queryDistrict(district: string, state?: string): Promise<DistrictFloodContext | null> {
  const response = await retrieve({
    action: 'district_flood_metrics',
    district,
    ...(state ? { state } : {})
  });
  const result = response?.result;
  const records = Array.isArray(result?.dfsi) ? result.dfsi : [];
  if (result?.ambiguous || records.length !== 1) return null;
  const record = records[0];
  const raw = Number(record.dfsi);
  if (!Number.isFinite(raw)) return null;
  return {
    district: String(record.district_name || district),
    state: String(record.state_name || state || ''),
    dfsiRaw: raw,
    dfsiNormalized: normalizeDfsi(raw),
    sourceFile: record.source_file ? String(record.source_file) : undefined
  };
}

export const riskService = {
  async getDistrictFloodContext(location: LocationData): Promise<DistrictFloodContext | null> {
    const key = location.name.toLowerCase().trim();
    const alias = CITY_DISTRICT_ALIASES[key];
    if (alias) {
      const aliased = await queryDistrict(alias.district, alias.state || location.state);
      if (aliased) return aliased;
    }

    const direct = await queryDistrict(location.name, location.state);
    if (direct) return direct;

    const resolved = await retrieve({
      action: 'resolve_location',
      text: `${location.name} ${location.state}`
    });
    const match = resolved?.result?.match;
    if (!match?.name) return null;
    return queryDistrict(String(match.name), match.state ? String(match.state) : location.state);
  },

  toLiveInputs(location: LocationData, floodContext: DistrictFloodContext | null): RiskInputs {
    const isBengaluru = /bengaluru|bangalore/i.test(location.name);
    const ml = isBengaluru ? location.rainPrediction : null;
    return {
      rainMm24h: location.precipitation.dailyTotalMm,
      maxTemperatureC: location.high,
      apparentTemperatureC: location.feelsLike,
      humidityPercent: location.humidity,
      windGustKmh: location.windGusts,
      aqi: Number.isFinite(location.airQuality.aqi) ? location.airQuality.aqi : null,
      aqiScale: Number.isFinite(location.airQuality.aqi) ? 'us' : 'unavailable',
      dfsiNormalized: floodContext?.dfsiNormalized ?? null,
      dfsiRaw: floodContext?.dfsiRaw ?? null,
      rainMlProbability: ml?.probability ?? null,
      rainMlWillRain: ml?.willRain ?? null,
      useBengaluruMl: Boolean(ml),
      sourceLabel: location.isLive ? 'Open-Meteo live forecast' : 'Demo fallback data',
      updatedAt: new Date().toISOString()
    };
  }
};
