import { HourlyForecastItem, LocationData } from '../types';

export interface AIResponse {
  query: string;
  summary: string;
  riskLevel: 'Low' | 'Moderate' | 'High';
  timing: string;
  actionItems: string[];
  timestamp: string;
  sourceDisclaimer: string;
  sources: string[];
}

export interface WeatherGPTLiveWeather {
  source?: string;
  isLive?: boolean;
  condition: string;
  temperatureC: number;
  feelsLikeC: number;
  highC: number;
  lowC: number;
  humidityPercent: number;
  windSpeedKmh: number;
  windDirection: string;
  windGustsKmh: number;
  uvIndex: number;
  visibilityKm: number;
  pressureHpa: number;
  precipitationMm: number;
  rainPrediction?: LocationData['rainPrediction'];
}

export function buildWeatherGPTLiveWeather(location: LocationData): WeatherGPTLiveWeather {
  return {
    source: location.dataSource,
    isLive: location.isLive,
    condition: location.condition,
    temperatureC: location.temperature,
    feelsLikeC: location.feelsLike,
    highC: location.high,
    lowC: location.low,
    humidityPercent: location.humidity,
    windSpeedKmh: location.windSpeed,
    windDirection: location.windDirection,
    windGustsKmh: location.windGusts,
    uvIndex: location.uvIndex,
    visibilityKm: location.visibility,
    pressureHpa: location.pressure,
    precipitationMm: location.precipitation.dailyTotalMm,
    rainPrediction: location.rainPrediction
  };
}

export const aiWeatherService = {
  async askWeatherGPT(
    prompt: string,
    location: LocationData,
    hourlyForecast: HourlyForecastItem[]
  ): Promise<AIResponse> {
    const liveWeather = buildWeatherGPTLiveWeather(location);
    const response = await fetch('/api/ai/weather', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        locationName: location.name,
        stateName: location.state,
        liveWeather,
        hourlyForecast: hourlyForecast.slice(0, 48).map(item => ({
          time: item.forecastTime || item.time,
          temperatureC: item.temperature,
          condition: item.condition,
          rainProbabilityPercent: item.rainProbability
        }))
      })
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || 'WeatherGPT is temporarily unavailable');
    }
    return payload as AIResponse;
  }
};
