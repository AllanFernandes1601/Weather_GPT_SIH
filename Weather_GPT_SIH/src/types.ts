export type NavTab = 'home' | 'forecast' | 'alerts' | 'weather-map' | 'safety';

export interface LocationData {
  id: string;
  name: string;
  state: string;
  coordinates: string;
  latitude?: number;
  longitude?: number;
  isLive?: boolean;
  dataSource?: string;
  isDay?: boolean;
  weatherIcon?: string;
  temperature: number;
  condition: string;
  feelsLike: number;
  high: number;
  low: number;
  greeting: string;
  humidity: number;
  humidityDesc: string;
  windSpeed: number;
  windDirection: string;
  windGusts: number;
  uvIndex: number;
  uvCategory: string;
  visibility: number;
  pressure: number;
  pressureTendency: string;
  radarStation: string;
  convectiveCell: string;
  airQuality: {
    aqi: number;
    status: string;
    pm25: number;
    pm10: number;
    description: string;
  };
  solarCycle: {
    daylightDuration: string;
    sunrise: string;
    sunset: string;
    progressPercentage: number;
  };
  precipitation: {
    dailyTotalMm: number;
    dewPoint: number;
    moistureFlux?: number;
    description: string;
  };
}

export interface HourlyForecastItem {
  time: string;
  temperature: number;
  condition: string;
  rainProbability: number;
  icon: string;
  isNow?: boolean;
  isWarning?: boolean;
  isPeakStorm?: boolean;
}

export interface WeatherAlert {
  id: string;
  severity: 'moderate' | 'high' | 'severe';
  badgeText: string;
  bulletinRef: string;
  stage: string;
  title: string;
  timeWindow: string;
  description: string;
  affectedCorridors: string[];
  routePrecautions: string[];
  safetyChecklist: string[];
}

export interface SuggestedQuestion {
  id: string;
  text: string;
  subtitle: string;
  icon: string;
  bgClass: string;
  borderClass: string;
  colSpan?: string;
  mockAnswer: {
    summary: string;
    riskLevel: 'Low' | 'Moderate' | 'High';
    timing: string;
    actionItems: string[];
  };
}

export interface RemoteLocationResult {
  name: string;
  state: string;
  country: string;
  latitude: number;
  longitude: number;
  displayName: string;
}
