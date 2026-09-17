export interface NationalWeatherStation {
  id: string;
  name: string;
  state: string;
  latitude: number;
  longitude: number;
  temperatureC: number | null;
  apparentTemperatureC: number | null;
  humidityPercent: number | null;
  currentPrecipitationMm: number | null;
  weatherCode: number | null;
  windGustKmh: number | null;
  maxTemperatureC: number | null;
  minTemperatureC: number | null;
  rainMm24h: number | null;
  rainProbabilityPercent: number | null;
  aqi: number | null;
  pm25: number | null;
  pm10: number | null;
  timezone: string;
  observedAt: string;
  isLive: boolean;
}

export interface NationalWeatherGrid {
  stations: NationalWeatherStation[];
  source: string;
  retrievedAt: string;
  coverage: string;
  cached?: boolean;
}

import { requestJson } from './apiClient';

export const nationalWeatherService = {
  async getGrid(signal?: AbortSignal): Promise<NationalWeatherGrid> {
    const result = await requestJson<NationalWeatherGrid>('/api/weather-grid', { signal });
    if (!Array.isArray(result.stations)) throw new Error('Nationwide weather grid response was invalid');
    return result;
  }
};
