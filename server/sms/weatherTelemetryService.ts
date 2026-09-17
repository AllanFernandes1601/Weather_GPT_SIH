import { WeatherTelemetryInput } from './alertEngine';

export interface RawOpenMeteoResult {
  weather: any;
  airQuality: any | null;
}

/**
 * Fetches raw forecast and air quality telemetry concurrently from Open-Meteo.
 * Shared between the /api/weather Express route and the SMS weather alert service.
 */
export async function fetchRawOpenMeteoWeather(
  latitude: number,
  longitude: number
): Promise<RawOpenMeteoResult> {
  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,apparent_temperature,relative_humidity_2m,dew_point_2m,precipitation,rain,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m,surface_pressure,visibility,uv_index,is_day&hourly=temperature_2m,apparent_temperature,precipitation_probability,precipitation,rain,weather_code,cloud_cover,wind_speed_10m,wind_gusts_10m,wind_direction_10m,relative_humidity_2m,surface_pressure,visibility,dew_point_2m,is_day&daily=temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_sum,precipitation_probability_max,weather_code&timezone=auto&past_hours=6&forecast_days=2`;
  const airQualityUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${latitude}&longitude=${longitude}&current=pm10,pm2_5,european_aqi,us_aqi`;

  const [weatherRes, airQualityRes] = await Promise.allSettled([
    fetch(weatherUrl, { headers: { 'User-Agent': 'WeatherGPT-App/1.0' } }),
    fetch(airQualityUrl, { headers: { 'User-Agent': 'WeatherGPT-App/1.0' } })
  ]);

  if (weatherRes.status !== 'fulfilled' || !weatherRes.value.ok) {
    const errorMsg =
      weatherRes.status === 'fulfilled'
        ? `Open-Meteo returned status ${weatherRes.value.status}`
        : weatherRes.reason?.message || 'Network error connecting to Open-Meteo';
    throw new Error(errorMsg);
  }

  const weatherData = await weatherRes.value.json();

  let airQualityData = null;
  if (airQualityRes.status === 'fulfilled' && airQualityRes.value.ok) {
    try {
      airQualityData = await airQualityRes.value.json();
    } catch (err) {
      console.warn('[Open-Meteo Air Quality Parse Warning]:', err);
    }
  }

  return {
    weather: weatherData,
    airQuality: airQualityData
  };
}

/**
 * Normalizes raw Open-Meteo responses into structured WeatherTelemetryInput
 * for deterministic alert evaluation.
 *
 * CRITICAL AQI RULE:
 * Do not relabel Open-Meteo US AQI as CPCB AQI.
 * If Open-Meteo returns us_aqi, populate us_aqi and leave indian_aqi/cpcb_aqi undefined.
 */
export function normalizeWeatherTelemetry(
  raw: RawOpenMeteoResult,
  latitude: number,
  longitude: number,
  locationName?: string
): WeatherTelemetryInput {
  const { weather, airQuality } = raw;
  const current = weather?.current || {};
  const hourly = weather?.hourly || {};
  const daily = weather?.daily || {};
  const aqCurrent = airQuality?.current || {};

  return {
    latitude,
    longitude,
    locationName,
    retrievedAt: new Date().toISOString(),
    source: 'Open-Meteo',
    current: {
      temperature_2m: typeof current.temperature_2m === 'number' ? current.temperature_2m : undefined,
      apparent_temperature: typeof current.apparent_temperature === 'number' ? current.apparent_temperature : undefined,
      precipitation: typeof current.precipitation === 'number' ? current.precipitation : undefined,
      rain: typeof current.rain === 'number' ? current.rain : undefined,
      weather_code: typeof current.weather_code === 'number' ? current.weather_code : undefined,
      wind_speed_10m: typeof current.wind_speed_10m === 'number' ? current.wind_speed_10m : undefined,
      wind_gusts_10m: typeof current.wind_gusts_10m === 'number' ? current.wind_gusts_10m : undefined,
      time: current.time
    },
    hourly: {
      time: Array.isArray(hourly.time) ? hourly.time : [],
      temperature_2m: Array.isArray(hourly.temperature_2m) ? hourly.temperature_2m : [],
      precipitation_probability: Array.isArray(hourly.precipitation_probability) ? hourly.precipitation_probability : [],
      precipitation: Array.isArray(hourly.precipitation) ? hourly.precipitation : [],
      rain: Array.isArray(hourly.rain) ? hourly.rain : [],
      weather_code: Array.isArray(hourly.weather_code) ? hourly.weather_code : [],
      wind_speed_10m: Array.isArray(hourly.wind_speed_10m) ? hourly.wind_speed_10m : [],
      wind_gusts_10m: Array.isArray(hourly.wind_gusts_10m) ? hourly.wind_gusts_10m : []
    },
    daily: {
      time: Array.isArray(daily.time) ? daily.time : [],
      temperature_2m_max: Array.isArray(daily.temperature_2m_max) ? daily.temperature_2m_max : [],
      temperature_2m_min: Array.isArray(daily.temperature_2m_min) ? daily.temperature_2m_min : [],
      precipitation_sum: Array.isArray(daily.precipitation_sum) ? daily.precipitation_sum : [],
      precipitation_probability_max: Array.isArray(daily.precipitation_probability_max) ? daily.precipitation_probability_max : [],
      weather_code: Array.isArray(daily.weather_code) ? daily.weather_code : []
    },
    airQuality: {
      pm10: typeof aqCurrent.pm10 === 'number' ? aqCurrent.pm10 : undefined,
      pm2_5: typeof aqCurrent.pm2_5 === 'number' ? aqCurrent.pm2_5 : undefined,
      european_aqi: typeof aqCurrent.european_aqi === 'number' ? aqCurrent.european_aqi : undefined,
      us_aqi: typeof aqCurrent.us_aqi === 'number' ? aqCurrent.us_aqi : undefined,
      // Deliberately undefined so alert engine uses standard US-AQI fallback
      indian_aqi: undefined,
      cpcb_aqi: undefined
    }
  };
}

/**
 * Fetches and normalizes weather telemetry for SMS alert evaluation.
 */
export async function fetchWeatherTelemetryForSms(
  latitude: number,
  longitude: number,
  locationName?: string
): Promise<WeatherTelemetryInput> {
  const raw = await fetchRawOpenMeteoWeather(latitude, longitude);
  return normalizeWeatherTelemetry(raw, latitude, longitude, locationName);
}
