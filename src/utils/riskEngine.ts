export type RiskLevel = 'Low' | 'Moderate' | 'High' | 'Severe' | 'Unavailable';
export type RiskKind = 'rain' | 'heat' | 'wind' | 'flood' | 'aqi';
export type RiskMethod = 'ml-model' | 'official-category' | 'project-rule' | 'unavailable';

export interface RiskInputs {
  rainMm24h: number;
  maxTemperatureC: number;
  apparentTemperatureC: number;
  humidityPercent: number;
  windGustKmh: number;
  aqi: number | null;
  aqiScale: 'us' | 'unavailable';
  dfsiNormalized: number | null;
  dfsiRaw: number | null;
  rainMlProbability: number | null;
  rainMlWillRain: boolean | null;
  useBengaluruMl: boolean;
  sourceLabel: string;
  updatedAt: string;
}

export interface RiskAssessment {
  kind: RiskKind;
  title: string;
  icon: string;
  level: RiskLevel;
  displayValue: string;
  reason: string;
  precautions: string[];
  source: string;
  method: RiskMethod;
  methodLabel: string;
  limitation: string;
  updatedAt: string;
  gaugeValue: number;
  estimateNote?: string;
  contributions?: Array<{
    label: string;
    value: number;
    displayValue: string;
  }>;
}

export interface RiskGaugeSnapshot {
  values: Record<RiskKind, number>;
  floodContributions: {
    rainfallLoad: number;
    districtSusceptibility: number;
  };
}

export interface RiskAssessmentSet {
  inputs: RiskInputs;
  assessments: Record<RiskKind, RiskAssessment>;
  highestAvailableRisk: RiskAssessment;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const finiteOr = (value: number, fallback = 0) => Number.isFinite(value) ? value : fallback;

function bandedGauge(value: number, moderateAt: number, highAt: number, severeAt: number, ceiling: number): number {
  const safe = Math.max(0, finiteOr(value));
  if (safe < moderateAt) return clamp((safe / moderateAt) * 24, 0, 24);
  if (safe < highAt) return 25 + clamp((safe - moderateAt) / (highAt - moderateAt), 0, 1) * 24;
  if (safe < severeAt) return 50 + clamp((safe - highAt) / (severeAt - highAt), 0, 1) * 24;
  return 75 + clamp((safe - severeAt) / Math.max(ceiling - severeAt, 1), 0, 1) * 25;
}

export function calculateRiskGaugeSnapshot(inputs: RiskInputs): RiskGaugeSnapshot {
  const rainMm = Math.max(0, finiteOr(inputs.rainMm24h));
  const rainValue = inputs.useBengaluruMl && inputs.rainMlProbability !== null
    ? bandedGauge(clamp(inputs.rainMlProbability, 0, 1) * 100, 35, 65, 101, 125)
    : bandedGauge(rainMm, 15.6, 64.5, 204.5, 300);
  const heatValue = bandedGauge(
    Math.max(finiteOr(inputs.maxTemperatureC), finiteOr(inputs.apparentTemperatureC)),
    40,
    45,
    47,
    52
  );
  const windValue = bandedGauge(inputs.windGustKmh, 52, 62, 88, 140);
  const rainfallLoad = clamp((rainMm / 115.5) * 100, 0, 100);
  const districtSusceptibility = inputs.dfsiNormalized === null
    ? 0
    : clamp(inputs.dfsiNormalized * 100, 0, 100);
  const floodScore = Math.min(rainMm / 115.5, 1.5) * (0.4 + 0.6 * (inputs.dfsiNormalized ?? 0));
  const floodValue = inputs.dfsiNormalized === null
    ? 0
    : bandedGauge(floodScore, 0.3, 0.6, 1, 1.5);
  const aqiValue = inputs.aqi === null || inputs.aqiScale === 'unavailable'
    ? 0
    : bandedGauge(inputs.aqi, 51, 151, 201, 500);

  return {
    values: { rain: rainValue, heat: heatValue, wind: windValue, flood: floodValue, aqi: aqiValue },
    floodContributions: { rainfallLoad, districtSusceptibility }
  };
}

const levelWeight: Record<RiskLevel, number> = {
  Unavailable: -1,
  Low: 0,
  Moderate: 1,
  High: 2,
  Severe: 3
};

function risk(
  base: Omit<RiskAssessment, 'updatedAt'>,
  updatedAt: string
): RiskAssessment {
  return { ...base, updatedAt };
}

function calculateRainRisk(inputs: RiskInputs, gauges: RiskGaugeSnapshot): RiskAssessment {
  const mm = Math.max(0, finiteOr(inputs.rainMm24h));
  if (inputs.useBengaluruMl && inputs.rainMlProbability !== null) {
    const probability = clamp(inputs.rainMlProbability, 0, 1);
    const percent = Math.round(probability * 100);
    const level: RiskLevel = percent < 35 ? 'Low' : percent < 65 ? 'Moderate' : 'High';
    return risk({
      kind: 'rain',
      title: 'Next-hour rain',
      icon: 'rainy',
      level,
      displayValue: `${percent}%`,
      reason: `The Bengaluru rain model estimates a ${percent}% chance of rain in the next hour${inputs.rainMlWillRain ? ' and crosses its rain decision threshold' : ''}.`,
      precautions: level === 'Low'
        ? ['No special rain precaution is indicated; keep checking live updates.']
        : ['Carry rain protection.', 'Allow extra travel time on waterlogging-prone roads.'],
      source: 'WeatherGPT Bengaluru ML model',
      method: 'ml-model',
      methodLabel: 'ML probability',
      limitation: 'Model is valid only within the Bengaluru model area and is not an official warning.',
      gaugeValue: gauges.values.rain,
      estimateNote: 'Estimated by the Bengaluru ML model, not a direct measurement.'
    }, inputs.updatedAt);
  }

  let level: RiskLevel = 'Low';
  let category = 'very light to light rainfall';
  if (mm >= 204.5) {
    level = 'Severe';
    category = 'extremely heavy rainfall';
  } else if (mm >= 115.6) {
    level = 'High';
    category = 'very heavy rainfall';
  } else if (mm >= 64.5) {
    level = 'High';
    category = 'heavy rainfall';
  } else if (mm >= 15.6) {
    level = 'Moderate';
    category = 'moderate rainfall';
  }

  return risk({
    kind: 'rain',
    title: '24-hour rain',
    icon: 'rainy',
    level,
    displayValue: `${mm.toFixed(1)} mm`,
    reason: `${mm.toFixed(1)} mm forecast accumulation falls in the IMD ${category} range; the displayed risk level is WeatherGPT's preparedness mapping.`,
    precautions: level === 'Low'
      ? ['Normal travel awareness is sufficient.']
      : level === 'Moderate'
        ? ['Carry rain protection.', 'Watch for short-lived surface waterlogging.']
        : ['Avoid flooded roads and underpasses.', 'Monitor official district and IMD advisories.'],
    source: inputs.sourceLabel,
    method: 'official-category',
    methodLabel: 'IMD category + project risk band',
    limitation: 'Rainfall category is IMD-based; Low/Moderate/High/Severe is a WeatherGPT preparedness interpretation.',
    gaugeValue: gauges.values.rain,
    estimateNote: 'Estimated from forecast rainfall, not a direct measurement.'
  }, inputs.updatedAt);
}

function calculateHeatRisk(inputs: RiskInputs, gauges: RiskGaugeSnapshot): RiskAssessment {
  const maximum = finiteOr(inputs.maxTemperatureC);
  const feelsLike = Math.max(maximum, finiteOr(inputs.apparentTemperatureC, maximum));
  const effective = Math.max(maximum, feelsLike);
  const level: RiskLevel = maximum >= 47
    ? 'Severe'
    : maximum >= 45
      ? 'High'
      : effective >= 40
        ? 'Moderate'
        : 'Low';

  return risk({
    kind: 'heat',
    title: 'Heat stress',
    icon: 'device_thermostat',
    level,
    displayValue: `${Math.round(effective)}°C`,
    reason: `Forecast maximum is ${maximum.toFixed(1)}°C, feels-like input is ${feelsLike.toFixed(1)}°C, with ${Math.round(inputs.humidityPercent)}% humidity.`,
    precautions: level === 'Low'
      ? ['Stay hydrated during normal outdoor activity.']
      : ['Limit strenuous activity during the hottest hours.', 'Hydrate frequently and check on vulnerable people.'],
    source: inputs.sourceLabel,
    method: 'project-rule',
    methodLabel: 'Forecast heat-stress rule',
    limitation: 'This is not an IMD heatwave declaration because departure-from-normal and persistence criteria are not evaluated.',
    gaugeValue: gauges.values.heat,
    estimateNote: 'Estimated from forecast temperature and apparent temperature, not a direct measurement.'
  }, inputs.updatedAt);
}

function calculateWindRisk(inputs: RiskInputs, gauges: RiskGaugeSnapshot): RiskAssessment {
  const gust = Math.max(0, finiteOr(inputs.windGustKmh));
  const level: RiskLevel = gust >= 88 ? 'Severe' : gust >= 62 ? 'High' : gust >= 52 ? 'Moderate' : 'Low';
  return risk({
    kind: 'wind',
    title: 'Wind gust',
    icon: 'air',
    level,
    displayValue: `${Math.round(gust)} km/h`,
    reason: `Forecast gusts reach ${Math.round(gust)} km/h; WeatherGPT bands are aligned to IMD squall wind-speed ranges for preparedness.`,
    precautions: level === 'Low'
      ? ['No special wind precaution is indicated.']
      : ['Secure loose outdoor objects.', 'Avoid trees, temporary structures and exposed travel routes.'],
    source: inputs.sourceLabel,
    method: 'project-rule',
    methodLabel: 'IMD-aligned project rule',
    limitation: 'This does not classify the event as a squall, gale or cyclone.',
    gaugeValue: gauges.values.wind,
    estimateNote: 'Estimated from forecast wind gusts, not a direct measurement.'
  }, inputs.updatedAt);
}

function calculateFloodRisk(inputs: RiskInputs, gauges: RiskGaugeSnapshot): RiskAssessment {
  if (inputs.dfsiNormalized === null) {
    return risk({
      kind: 'flood',
      title: 'Flood susceptibility',
      icon: 'flood',
      level: 'Unavailable',
      displayValue: 'No district match',
      reason: 'No unambiguous district DFSI record could be matched to the selected location.',
      precautions: ['Use rainfall and official local flood advisories until district susceptibility is available.'],
      source: 'WeatherGPT district DFSI dataset',
      method: 'unavailable',
      methodLabel: 'Unavailable',
      limitation: 'WeatherGPT does not invent or substitute a district susceptibility value.',
      gaugeValue: 0
    }, inputs.updatedAt);
  }

  const dfsi = clamp(inputs.dfsiNormalized, 0, 1);
  const rainFactor = Math.min(Math.max(inputs.rainMm24h, 0) / 115.5, 1.5);
  const score = rainFactor * (0.4 + 0.6 * dfsi);
  const level: RiskLevel = score >= 1 ? 'Severe' : score >= 0.6 ? 'High' : score >= 0.3 ? 'Moderate' : 'Low';
  return risk({
    kind: 'flood',
    title: 'Flood susceptibility',
    icon: 'flood',
    level,
    displayValue: `${Math.round(score * 100)} index`,
    reason: `${inputs.rainMm24h.toFixed(1)} mm forecast rainfall is combined with district-relative DFSI ${inputs.dfsiRaw?.toFixed(2) ?? 'N/A'} (${Math.round(dfsi * 100)}th normalized scale point).`,
    precautions: level === 'Low'
      ? ['Continue monitoring local drainage and rainfall updates.']
      : ['Avoid low-lying roads and underpasses.', 'Follow official district evacuation or flood instructions if issued.'],
    source: `${inputs.sourceLabel} + WeatherGPT district DFSI dataset`,
    method: 'project-rule',
    methodLabel: 'Rain load × dataset-relative DFSI',
    limitation: 'Flood susceptibility estimate—not a hydrological flood probability or official warning.',
    gaugeValue: gauges.values.flood,
    estimateNote: 'Estimated from district DFSI and forecast rainfall, not a direct measurement.',
    contributions: [
      { label: 'Rainfall load', value: gauges.floodContributions.rainfallLoad, displayValue: `${inputs.rainMm24h.toFixed(1)} mm` },
      { label: 'District susceptibility', value: gauges.floodContributions.districtSusceptibility, displayValue: `${Math.round(dfsi * 100)}% relative` }
    ]
  }, inputs.updatedAt);
}

function calculateAqiRisk(inputs: RiskInputs, gauges: RiskGaugeSnapshot): RiskAssessment {
  if (inputs.aqi === null || inputs.aqiScale === 'unavailable') {
    return risk({
      kind: 'aqi',
      title: 'Air quality',
      icon: 'airwave',
      level: 'Unavailable',
      displayValue: 'Unavailable',
      reason: 'A live AQI value was not available for this location.',
      precautions: ['Consult a local official air-quality service if air pollution is a concern.'],
      source: 'Open-Meteo Air Quality API',
      method: 'unavailable',
      methodLabel: 'Unavailable',
      limitation: 'No AQI category is inferred without a valid source value.',
      gaugeValue: 0
    }, inputs.updatedAt);
  }

  const aqi = Math.max(0, finiteOr(inputs.aqi));
  const level: RiskLevel = aqi > 200 ? 'Severe' : aqi > 150 ? 'High' : aqi > 50 ? 'Moderate' : 'Low';
  return risk({
    kind: 'aqi',
    title: 'Air quality',
    icon: 'airwave',
    level,
    displayValue: `US AQI ${Math.round(aqi)}`,
    reason: `${inputs.sourceLabel} reports US AQI ${Math.round(aqi)} for the selected location.`,
    precautions: level === 'Low'
      ? ['Outdoor activity is generally suitable for most people.']
      : level === 'Moderate'
        ? ['Sensitive people should reduce prolonged outdoor exertion if symptomatic.']
        : ['Reduce prolonged outdoor exertion.', 'Sensitive groups should follow local health guidance.'],
    source: inputs.sourceLabel,
    method: 'official-category',
    methodLabel: 'US AQI category',
    limitation: 'US AQI is not CPCB National AQI and must not be presented as a CPCB category.',
    gaugeValue: gauges.values.aqi,
    estimateNote: 'Provided by Open-Meteo; not measured by a local WeatherGPT sensor.'
  }, inputs.updatedAt);
}

export function calculateRiskFromInputs(inputs: RiskInputs): RiskAssessmentSet {
  const gauges = calculateRiskGaugeSnapshot(inputs);
  const assessments: Record<RiskKind, RiskAssessment> = {
    rain: calculateRainRisk(inputs, gauges),
    heat: calculateHeatRisk(inputs, gauges),
    wind: calculateWindRisk(inputs, gauges),
    flood: calculateFloodRisk(inputs, gauges),
    aqi: calculateAqiRisk(inputs, gauges)
  };
  const highestAvailableRisk = Object.values(assessments).reduce((highest, current) =>
    levelWeight[current.level] > levelWeight[highest.level] ? current : highest
  );
  return { inputs, assessments, highestAvailableRisk };
}

export const DFSI_DATASET_MIN = 4.2444845797466;
export const DFSI_DATASET_MAX = 19.3005641040421;

export function normalizeDfsi(raw: number): number {
  if (!Number.isFinite(raw)) return 0;
  return clamp((raw - DFSI_DATASET_MIN) / (DFSI_DATASET_MAX - DFSI_DATASET_MIN), 0, 1);
}
