import { SmsAlertType, AlertSeverity, WeatherAlert } from './types';
import {
  AlertThresholdConfig,
  DEFAULT_ALERT_THRESHOLDS,
  SEVERITY_RANK,
  maxSeverity
} from './alertThresholds';

/**
 * Normalized meteorological telemetry input for alert evaluation.
 * Completely decoupled from Express request/response objects.
 */
export interface WeatherTelemetryInput {
  latitude: number;
  longitude: number;
  locationName?: string;
  retrievedAt?: string;
  source?: string;

  current?: {
    temperature_2m?: number;
    apparent_temperature?: number;
    precipitation?: number;
    rain?: number;
    weather_code?: number;
    wind_speed_10m?: number;
    wind_gusts_10m?: number;
    time?: string;
  };

  hourly?: {
    time?: string[];
    temperature_2m?: number[];
    precipitation_probability?: number[];
    precipitation?: number[];
    rain?: number[];
    weather_code?: number[];
    wind_speed_10m?: number[];
    wind_gusts_10m?: number[];
  };

  daily?: {
    time?: string[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    precipitation_sum?: number[];
    precipitation_probability_max?: number[];
    weather_code?: number[];
  };

  airQuality?: {
    /**
     * Preferred: Central Pollution Control Board (CPCB) India National AQI (0–500 scale).
     */
    cpcb_aqi?: number;
    indian_aqi?: number;
    /**
     * Fallback: US EPA AQI (0–500 scale). Used only when Indian/CPCB AQI is not provided.
     */
    us_aqi?: number;
    european_aqi?: number;
    pm10?: number;
    pm2_5?: number;
  };

  /**
   * Explicit flood indicator or river discharge gauge exceedance.
   * In Phase 4, flood alerts are strictly NOT inferred from rainfall alone.
   * A flood alert is generated only if verified flood risk data is explicitly passed.
   */
  floodRisk?: {
    isFloodingReported?: boolean;
    riverDischargeAlert?: boolean;
    severity?: AlertSeverity;
    description?: string;
  };
}

/**
 * Generates a stable, deterministic alert ID for deduplication and cooldown tracking.
 * Format: alert_<type>_<lat>_<lon>_<timeBucket>
 */
export function generateDeterministicAlertId(
  alertType: SmsAlertType,
  latitude: number,
  longitude: number,
  timeAnchor: string
): string {
  const latStr = latitude.toFixed(2);
  const lonStr = longitude.toFixed(2);
  // Extract YYYYMMDD_HH from ISO timestamp for hourly or daily stability
  const cleanTime = timeAnchor.replace(/[-:]/g, '').replace(/T/, '_').slice(0, 11);
  return `alert_${alertType}_${latStr}_${lonStr}_${cleanTime}`;
}

/**
 * Extracts a concise time window string ("18:00–21:00") from ISO dates.
 */
function formatTimeWindow(startIso: string, endIso: string): string {
  try {
    const s = startIso.slice(11, 16);
    const e = endIso.slice(11, 16);
    if (s && e && s !== e) return `${s}–${e}`;
    return s || 'shortly';
  } catch {
    return 'shortly';
  }
}

/**
 * Pure deterministic weather alert evaluation engine.
 *
 * Consumes normalized weather telemetry and returns an array of WeatherAlert entities.
 * Never calls Gemini, makes zero network requests, and performs no subscriber lookups.
 */
export function evaluateWeatherAlerts(
  input: WeatherTelemetryInput,
  thresholds: AlertThresholdConfig = DEFAULT_ALERT_THRESHOLDS
): WeatherAlert[] {
  const alerts: WeatherAlert[] = [];
  const detectedAt = input.retrievedAt || new Date().toISOString();
  const locationLabel = input.locationName?.trim() || `Station (${input.latitude.toFixed(2)}, ${input.longitude.toFixed(2)})`;
  const defaultSource = input.source || 'Open-Meteo-Observation';

  const current = input.current || {};
  const hourly = input.hourly || {};
  const daily = input.daily || {};
  const airQuality = input.airQuality || {};

  const horizon = thresholds.forecastHorizonHours || 24;
  const hourlyTimes = hourly.time || [];
  const hourlyPrecip = hourly.precipitation || [];
  const hourlyCodes = hourly.weather_code || [];
  const hourlyWindGusts = hourly.wind_gusts_10m || [];
  const hourlyWindSpeed = hourly.wind_speed_10m || [];
  const hourlyTemps = hourly.temperature_2m || [];

  // =========================================================================
  // 1. HEAVY RAIN (heavy_rain)
  // Strictly separates short-duration intensity (mm/h) from 24h accumulation (mm).
  // =========================================================================
  {
    let maxRainSeverity: AlertSeverity | null = null;
    let triggerTime = current.time || detectedAt;
    let endTime = detectedAt;
    let triggerMetricDescription = '';
    const rainThresh = thresholds.heavyRain;

    // A. Current short-duration intensity check (mm/hour)
    const currentIntensity = current.precipitation ?? 0;
    if (currentIntensity >= rainThresh.rainfallIntensityMmPerHour.severe) {
      maxRainSeverity = 'severe';
      triggerMetricDescription = `intensity ${currentIntensity}mm/h`;
    } else if (currentIntensity >= rainThresh.rainfallIntensityMmPerHour.high) {
      maxRainSeverity = 'high';
      triggerMetricDescription = `intensity ${currentIntensity}mm/h`;
    } else if (currentIntensity >= rainThresh.rainfallIntensityMmPerHour.moderate) {
      maxRainSeverity = 'moderate';
      triggerMetricDescription = `intensity ${currentIntensity}mm/h`;
    }

    // Heavy rain WMO codes check (WMO 65: Heavy rain; WMO 82: Violent showers)
    if (current.weather_code !== undefined && rainThresh.wmoCodes.heavy.includes(current.weather_code)) {
      maxRainSeverity = maxRainSeverity ? maxSeverity(maxRainSeverity, 'high') : 'high';
      if (!triggerMetricDescription) triggerMetricDescription = `heavy rain code (${current.weather_code})`;
    }

    // B. Hourly forecast short-duration intensity check (mm/hour)
    const scanCount = Math.min(hourlyTimes.length, horizon);
    let peakForecastHourIdx = -1;
    let peakForecastIntensity = currentIntensity;

    for (let i = 0; i < scanCount; i++) {
      const p = hourlyPrecip[i] ?? 0;
      const code = hourlyCodes[i] ?? 0;

      let hourSeverity: AlertSeverity | null = null;
      if (p >= rainThresh.rainfallIntensityMmPerHour.severe) hourSeverity = 'severe';
      else if (p >= rainThresh.rainfallIntensityMmPerHour.high) hourSeverity = 'high';
      else if (p >= rainThresh.rainfallIntensityMmPerHour.moderate) hourSeverity = 'moderate';

      if (rainThresh.wmoCodes.heavy.includes(code)) {
        hourSeverity = hourSeverity ? maxSeverity(hourSeverity, 'high') : 'high';
      }

      if (hourSeverity) {
        if (!maxRainSeverity || SEVERITY_RANK[hourSeverity] > SEVERITY_RANK[maxRainSeverity]) {
          maxRainSeverity = hourSeverity;
          peakForecastHourIdx = i;
          peakForecastIntensity = p;
          triggerMetricDescription = `forecast intensity ${p}mm/h`;
        }
      }
    }

    // C. 24-hour cumulative accumulation check (mm/24h)
    // Evaluated strictly against rainfallAccumulation24hMm, never against intensity.
    const dailyAccumulation = daily.precipitation_sum?.[0] ?? 0;
    let accumSeverity: AlertSeverity | null = null;

    if (dailyAccumulation >= rainThresh.rainfallAccumulation24hMm.severe) {
      accumSeverity = 'severe';
    } else if (dailyAccumulation >= rainThresh.rainfallAccumulation24hMm.high) {
      accumSeverity = 'high';
    } else if (dailyAccumulation >= rainThresh.rainfallAccumulation24hMm.moderate) {
      accumSeverity = 'moderate';
    }

    if (accumSeverity) {
      if (!maxRainSeverity || SEVERITY_RANK[accumSeverity] >= SEVERITY_RANK[maxRainSeverity]) {
        maxRainSeverity = accumSeverity;
        triggerMetricDescription = `24h accumulation ${dailyAccumulation}mm`;
      }
    }

    if (maxRainSeverity) {
      if (peakForecastHourIdx !== -1 && hourlyTimes[peakForecastHourIdx]) {
        triggerTime = hourlyTimes[peakForecastHourIdx];
        const endIdx = Math.min(hourlyTimes.length - 1, peakForecastHourIdx + 3);
        endTime = hourlyTimes[endIdx] || triggerTime;
      } else {
        triggerTime = current.time || detectedAt;
        endTime = new Date(new Date(triggerTime).getTime() + 3 * 3600 * 1000).toISOString();
      }

      const timeWindow = formatTimeWindow(triggerTime, endTime);
      const alertId = generateDeterministicAlertId('heavy_rain', input.latitude, input.longitude, triggerTime);

      alerts.push({
        id: alertId,
        alertType: 'heavy_rain',
        severity: maxRainSeverity,
        title: `Heavy Rain Advisory (${maxRainSeverity.toUpperCase()})`,
        summary: `Significant rainfall (${triggerMetricDescription}) around ${locationLabel}.`,
        smsText: `[WeatherGPT] ${maxRainSeverity.toUpperCase()} Heavy Rain risk for ${locationLabel}. Expected ${triggerMetricDescription} (${timeWindow}). Avoid flood-prone underpasses.`,
        coordinates: {
          latitude: input.latitude,
          longitude: input.longitude
        },
        affectedRadiusKm: thresholds.defaultAffectedRadiusKm.heavy_rain || 20,
        startTime: triggerTime,
        endTime,
        source: peakForecastHourIdx !== -1 ? 'Open-Meteo-Forecast' : defaultSource,
        detectedAt
      });
    }
  }

  // =========================================================================
  // 2. THUNDERSTORM (thunderstorm)
  // Deterministic WMO code recognition (WMO 95: Storm, WMO 96/99: Hailstorm).
  // =========================================================================
  {
    let stormSeverity: AlertSeverity | null = null;
    let triggerTime = current.time || detectedAt;
    let endTime = detectedAt;
    let peakGust = current.wind_gusts_10m ?? 0;

    const stormThresh = thresholds.thunderstorm;

    // Check current WMO code
    if (current.weather_code !== undefined) {
      if (stormThresh.wmoCodes.severe.includes(current.weather_code)) {
        stormSeverity = 'severe'; // Hailstorm
      } else if (stormThresh.wmoCodes.moderate.includes(current.weather_code)) {
        stormSeverity = (current.wind_gusts_10m ?? 0) >= stormThresh.windGustMinKmH ? 'high' : 'moderate';
      }
    }

    // Check hourly forecast
    const scanCount = Math.min(hourlyTimes.length, horizon);
    for (let i = 0; i < scanCount; i++) {
      const code = hourlyCodes[i] ?? 0;
      const gust = hourlyWindGusts[i] ?? 0;
      let hourSev: AlertSeverity | null = null;

      if (stormThresh.wmoCodes.severe.includes(code)) {
        hourSev = 'severe';
      } else if (stormThresh.wmoCodes.moderate.includes(code)) {
        hourSev = gust >= stormThresh.windGustMinKmH ? 'high' : 'moderate';
      }

      if (hourSev) {
        if (!stormSeverity || SEVERITY_RANK[hourSev] > SEVERITY_RANK[stormSeverity]) {
          stormSeverity = hourSev;
          triggerTime = hourlyTimes[i] || triggerTime;
          endTime = hourlyTimes[Math.min(hourlyTimes.length - 1, i + 2)] || triggerTime;
          peakGust = Math.max(peakGust, gust);
        }
      }
    }

    if (stormSeverity) {
      if (endTime === detectedAt) {
        endTime = new Date(new Date(triggerTime).getTime() + 2 * 3600 * 1000).toISOString();
      }
      const timeWindow = formatTimeWindow(triggerTime, endTime);
      const alertId = generateDeterministicAlertId('thunderstorm', input.latitude, input.longitude, triggerTime);

      const hailNotice = stormSeverity === 'severe' ? ' with hail' : '';
      alerts.push({
        id: alertId,
        alertType: 'thunderstorm',
        severity: stormSeverity,
        title: `Thunderstorm Warning (${stormSeverity.toUpperCase()})`,
        summary: `Thunderstorm activity${hailNotice} detected/forecast with wind gusts up to ${peakGust}km/h.`,
        smsText: `[WeatherGPT] ${stormSeverity.toUpperCase()} Thunderstorm alert for ${locationLabel}. Lightning and storm gusts${hailNotice} expected (${timeWindow}). Stay indoors.`,
        coordinates: {
          latitude: input.latitude,
          longitude: input.longitude
        },
        affectedRadiusKm: thresholds.defaultAffectedRadiusKm.thunderstorm || 25,
        startTime: triggerTime,
        endTime,
        source: defaultSource,
        detectedAt
      });
    }
  }

  // =========================================================================
  // 3. STRONG WIND (strong_wind)
  // Configurable WeatherGPT operational triggers.
  // =========================================================================
  {
    let windSeverity: AlertSeverity | null = null;
    let peakGust = current.wind_gusts_10m ?? 0;
    let peakSpeed = current.wind_speed_10m ?? 0;
    let triggerTime = current.time || detectedAt;
    let endTime = detectedAt;

    const windThresh = thresholds.strongWind;

    // Current observation
    if (peakGust >= windThresh.windGustKmH.severe || peakSpeed >= windThresh.windSpeedKmH.severe) {
      windSeverity = 'severe';
    } else if (peakGust >= windThresh.windGustKmH.high || peakSpeed >= windThresh.windSpeedKmH.high) {
      windSeverity = 'high';
    } else if (peakGust >= windThresh.windGustKmH.moderate || peakSpeed >= windThresh.windSpeedKmH.moderate) {
      windSeverity = 'moderate';
    }

    // Hourly forecast
    const scanCount = Math.min(hourlyTimes.length, horizon);
    for (let i = 0; i < scanCount; i++) {
      const g = hourlyWindGusts[i] ?? 0;
      const s = hourlyWindSpeed[i] ?? 0;
      let hourSev: AlertSeverity | null = null;

      if (g >= windThresh.windGustKmH.severe || s >= windThresh.windSpeedKmH.severe) {
        hourSev = 'severe';
      } else if (g >= windThresh.windGustKmH.high || s >= windThresh.windSpeedKmH.high) {
        hourSev = 'high';
      } else if (g >= windThresh.windGustKmH.moderate || s >= windThresh.windSpeedKmH.moderate) {
        hourSev = 'moderate';
      }

      if (hourSev) {
        if (!windSeverity || SEVERITY_RANK[hourSev] > SEVERITY_RANK[windSeverity]) {
          windSeverity = hourSev;
          triggerTime = hourlyTimes[i] || triggerTime;
          endTime = hourlyTimes[Math.min(hourlyTimes.length - 1, i + 3)] || triggerTime;
          peakGust = Math.max(peakGust, g);
          peakSpeed = Math.max(peakSpeed, s);
        }
      }
    }

    if (windSeverity) {
      if (endTime === detectedAt) {
        endTime = new Date(new Date(triggerTime).getTime() + 3 * 3600 * 1000).toISOString();
      }
      const timeWindow = formatTimeWindow(triggerTime, endTime);
      const alertId = generateDeterministicAlertId('strong_wind', input.latitude, input.longitude, triggerTime);

      alerts.push({
        id: alertId,
        alertType: 'strong_wind',
        severity: windSeverity,
        title: `High Wind Warning (${windSeverity.toUpperCase()})`,
        summary: `Elevated winds with gusts up to ${peakGust}km/h (sustained ${peakSpeed}km/h).`,
        smsText: `[WeatherGPT] ${windSeverity.toUpperCase()} Strong Wind alert for ${locationLabel}. Wind gusts up to ${peakGust}km/h forecast (${timeWindow}). Secure loose structures.`,
        coordinates: {
          latitude: input.latitude,
          longitude: input.longitude
        },
        affectedRadiusKm: thresholds.defaultAffectedRadiusKm.strong_wind || 35,
        startTime: triggerTime,
        endTime,
        source: defaultSource,
        detectedAt
      });
    }
  }

  // =========================================================================
  // 4. EXTREME HEAT (extreme_heat)
  // Configurable WeatherGPT operational triggers (Not official IMD declarations).
  // =========================================================================
  {
    let heatSeverity: AlertSeverity | null = null;
    let peakTemp = Math.max(
      current.temperature_2m ?? -99,
      daily.temperature_2m_max?.[0] ?? -99
    );
    let peakFeels = current.apparent_temperature ?? -99;
    let triggerTime = current.time || detectedAt;
    let endTime = detectedAt;

    const heatThresh = thresholds.extremeHeat;

    // Check hourly peak
    const scanCount = Math.min(hourlyTimes.length, horizon);
    for (let i = 0; i < scanCount; i++) {
      const t = hourlyTemps[i] ?? -99;
      if (t > peakTemp) {
        peakTemp = t;
        triggerTime = hourlyTimes[i] || triggerTime;
      }
    }

    if (peakTemp >= heatThresh.temperatureC.severe || peakFeels >= heatThresh.apparentTemperatureC.severe) {
      heatSeverity = 'severe';
    } else if (peakTemp >= heatThresh.temperatureC.high || peakFeels >= heatThresh.apparentTemperatureC.high) {
      heatSeverity = 'high';
    } else if (peakTemp >= heatThresh.temperatureC.moderate || peakFeels >= heatThresh.apparentTemperatureC.moderate) {
      heatSeverity = 'moderate';
    }

    if (heatSeverity) {
      endTime = new Date(new Date(triggerTime).getTime() + 6 * 3600 * 1000).toISOString();
      const timeWindow = formatTimeWindow(triggerTime, endTime);
      const alertId = generateDeterministicAlertId('extreme_heat', input.latitude, input.longitude, triggerTime);

      const feelsText = peakFeels > -99 ? ` (feels ${peakFeels}°C)` : '';
      alerts.push({
        id: alertId,
        alertType: 'extreme_heat',
        severity: heatSeverity,
        title: `Extreme Heat Advisory (${heatSeverity.toUpperCase()})`,
        summary: `High temperature of ${peakTemp}°C${feelsText} forecast.`,
        smsText: `[WeatherGPT] ${heatSeverity.toUpperCase()} Extreme Heat alert for ${locationLabel}. High of ${peakTemp}°C${feelsText} expected (${timeWindow}). Stay hydrated and out of direct sun.`,
        coordinates: {
          latitude: input.latitude,
          longitude: input.longitude
        },
        affectedRadiusKm: thresholds.defaultAffectedRadiusKm.extreme_heat || 50,
        startTime: triggerTime,
        endTime,
        source: defaultSource,
        detectedAt
      });
    }
  }

  // =========================================================================
  // 5. EXTREME COLD (extreme_cold)
  // Configurable WeatherGPT operational triggers (Not official IMD declarations).
  // =========================================================================
  {
    let coldSeverity: AlertSeverity | null = null;
    let minTemp = 99;
    let triggerTime = current.time || detectedAt;
    let endTime = detectedAt;

    if (current.temperature_2m !== undefined) {
      minTemp = current.temperature_2m;
    }
    if (daily.temperature_2m_min?.[0] !== undefined && daily.temperature_2m_min[0] < minTemp) {
      minTemp = daily.temperature_2m_min[0];
    }

    const scanCount = Math.min(hourlyTimes.length, horizon);
    for (let i = 0; i < scanCount; i++) {
      const t = hourlyTemps[i];
      if (t !== undefined && t < minTemp) {
        minTemp = t;
        triggerTime = hourlyTimes[i] || triggerTime;
      }
    }

    const coldThresh = thresholds.extremeCold;
    if (minTemp <= coldThresh.temperatureC.severe) {
      coldSeverity = 'severe';
    } else if (minTemp <= coldThresh.temperatureC.high) {
      coldSeverity = 'high';
    } else if (minTemp <= coldThresh.temperatureC.moderate) {
      coldSeverity = 'moderate';
    }

    if (coldSeverity) {
      endTime = new Date(new Date(triggerTime).getTime() + 6 * 3600 * 1000).toISOString();
      const timeWindow = formatTimeWindow(triggerTime, endTime);
      const alertId = generateDeterministicAlertId('extreme_cold', input.latitude, input.longitude, triggerTime);

      alerts.push({
        id: alertId,
        alertType: 'extreme_cold',
        severity: coldSeverity,
        title: `Cold Wave Advisory (${coldSeverity.toUpperCase()})`,
        summary: `Cold temperatures dropping to ${minTemp}°C.`,
        smsText: `[WeatherGPT] ${coldSeverity.toUpperCase()} Cold Wave alert for ${locationLabel}. Temperatures dropping to ${minTemp}°C (${timeWindow}). Stay warm and shelter vulnerable livestock.`,
        coordinates: {
          latitude: input.latitude,
          longitude: input.longitude
        },
        affectedRadiusKm: thresholds.defaultAffectedRadiusKm.extreme_cold || 50,
        startTime: triggerTime,
        endTime,
        source: defaultSource,
        detectedAt
      });
    }
  }

  // =========================================================================
  // 6. AIR QUALITY (air_quality)
  // Preferred: Central Pollution Control Board (CPCB) Indian National AQI bands.
  // Fallback: US EPA AQI, explicitly labeled as US AQI fallback.
  // =========================================================================
  {
    let aqiSeverity: AlertSeverity | null = null;
    let aqiSystem: 'CPCB' | 'US_EPA_FALLBACK' | 'PARTICULATES_ONLY' = 'PARTICULATES_ONLY';
    let reportedAqiVal: number | undefined;

    const aqThresh = thresholds.airQuality;
    const cpcbAqi = airQuality.cpcb_aqi ?? airQuality.indian_aqi;
    const usAqi = airQuality.us_aqi;
    const pm25 = airQuality.pm2_5;
    const pm10 = airQuality.pm10;

    // 1. Primary: CPCB India National AQI
    if (cpcbAqi !== undefined) {
      reportedAqiVal = cpcbAqi;
      aqiSystem = 'CPCB';
      if (cpcbAqi >= aqThresh.cpcbAqi.severe) {
        aqiSeverity = 'severe'; // Very Poor (301-400) or Severe (401-500+)
      } else if (cpcbAqi >= aqThresh.cpcbAqi.high) {
        aqiSeverity = 'high';   // Poor (201-300)
      } else if (cpcbAqi >= aqThresh.cpcbAqi.moderate) {
        aqiSeverity = 'moderate'; // Moderately Polluted (101-200)
      }
      // Note: 0-100 (Good, Satisfactory) yields null -> NO SMS alert
    } else if (usAqi !== undefined) {
      // 2. Separate Fallback: US EPA AQI (Clearly labeled, never conflated with CPCB)
      reportedAqiVal = usAqi;
      aqiSystem = 'US_EPA_FALLBACK';
      if (usAqi >= aqThresh.usAqiFallback.severe) {
        aqiSeverity = 'severe';
      } else if (usAqi >= aqThresh.usAqiFallback.high) {
        aqiSeverity = 'high';
      } else if (usAqi >= aqThresh.usAqiFallback.moderate) {
        aqiSeverity = 'moderate';
      }
    }

    // 3. Direct PM2.5 particulate check
    if (pm25 !== undefined) {
      let pm25Sev: AlertSeverity | null = null;
      if (pm25 >= aqThresh.pm25.severe) pm25Sev = 'severe';
      else if (pm25 >= aqThresh.pm25.high) pm25Sev = 'high';
      else if (pm25 >= aqThresh.pm25.moderate) pm25Sev = 'moderate';

      if (pm25Sev) {
        aqiSeverity = aqiSeverity ? maxSeverity(aqiSeverity, pm25Sev) : pm25Sev;
      }
    }

    // 4. Direct PM10 particulate check
    if (pm10 !== undefined) {
      let pm10Sev: AlertSeverity | null = null;
      if (pm10 >= aqThresh.pm10.severe) pm10Sev = 'severe';
      else if (pm10 >= aqThresh.pm10.high) pm10Sev = 'high';
      else if (pm10 >= aqThresh.pm10.moderate) pm10Sev = 'moderate';

      if (pm10Sev) {
        aqiSeverity = aqiSeverity ? maxSeverity(aqiSeverity, pm10Sev) : pm10Sev;
      }
    }

    if (aqiSeverity) {
      const triggerTime = current.time || detectedAt;
      const endTime = new Date(new Date(triggerTime).getTime() + 12 * 3600 * 1000).toISOString();
      const alertId = generateDeterministicAlertId('air_quality', input.latitude, input.longitude, triggerTime);

      let metricStr = '';
      if (aqiSystem === 'CPCB') {
        metricStr = `CPCB AQI ${reportedAqiVal}`;
      } else if (aqiSystem === 'US_EPA_FALLBACK') {
        metricStr = `US AQI ${reportedAqiVal} (fallback)`;
      } else {
        metricStr = pm25 !== undefined ? `PM2.5 ${pm25}µg/m³` : `PM10 ${pm10}µg/m³`;
      }

      alerts.push({
        id: alertId,
        alertType: 'air_quality',
        severity: aqiSeverity,
        title: `Air Quality Advisory (${aqiSeverity.toUpperCase()})`,
        summary: `Air pollution levels elevated (${metricStr}).`,
        smsText: `[WeatherGPT] ${aqiSeverity.toUpperCase()} Air Quality alert for ${locationLabel}. Pollution at ${metricStr}. Wear N95 masks and restrict outdoor activities.`,
        coordinates: {
          latitude: input.latitude,
          longitude: input.longitude
        },
        affectedRadiusKm: thresholds.defaultAffectedRadiusKm.air_quality || 30,
        startTime: triggerTime,
        endTime,
        source: aqiSystem === 'CPCB' ? 'CPCB-India-AQI' : 'Open-Meteo-Air-Quality',
        detectedAt
      });
    }
  }

  // =========================================================================
  // 7. FLOOD (flood) - Strictly gated on explicit flood risk data
  // Rainfall alone NEVER generates a flood alert.
  // =========================================================================
  {
    if (input.floodRisk && (input.floodRisk.isFloodingReported || input.floodRisk.riverDischargeAlert)) {
      const severity = input.floodRisk.severity || 'high';
      const triggerTime = detectedAt;
      const endTime = new Date(new Date(triggerTime).getTime() + 24 * 3600 * 1000).toISOString();
      const alertId = generateDeterministicAlertId('flood', input.latitude, input.longitude, triggerTime);

      alerts.push({
        id: alertId,
        alertType: 'flood',
        severity,
        title: `Flood Inundation Warning (${severity.toUpperCase()})`,
        summary: input.floodRisk.description || `Confirmed riverine/surface flood risk reported in ${locationLabel}.`,
        smsText: `[WeatherGPT] ${severity.toUpperCase()} Flood warning for ${locationLabel}. Rising water levels reported. Avoid riverbanks and follow local evacuation orders.`,
        coordinates: {
          latitude: input.latitude,
          longitude: input.longitude
        },
        affectedRadiusKm: thresholds.defaultAffectedRadiusKm.flood || 25,
        startTime: triggerTime,
        endTime,
        source: 'Explicit-Flood-Risk-Feed',
        detectedAt
      });
    }
  }

  return alerts;
}
