import { LocationData, HourlyForecastItem, WeatherAlert, RemoteLocationResult } from '../types';
import { LOCATIONS, HOURLY_FORECAST_DATA, ACTIVE_ALERT } from '../data/mockWeatherData';
import { normalizeOpenMeteoResponse } from '../utils/weatherUtils';

export interface WeatherFetchResult {
  location: LocationData;
  hourly: HourlyForecastItem[];
  isLive: boolean;
  error?: string;
}

export interface GeocodeResult {
  name: string;
  state: string;
  country: string;
  displayName: string;
}

/**
 * Parses coordinate strings like "12.97° N, 77.59° E" into numeric latitude & longitude
 */
export function parseCoordinateString(coordStr: string): { latitude: number; longitude: number } | null {
  try {
    const parts = coordStr.split(',');
    if (parts.length !== 2) return null;

    const latPart = parts[0].trim();
    const lonPart = parts[1].trim();

    let lat = parseFloat(latPart.replace(/[^\d.-]/g, ''));
    let lon = parseFloat(lonPart.replace(/[^\d.-]/g, ''));

    if (latPart.toUpperCase().includes('S')) lat = -lat;
    if (lonPart.toUpperCase().includes('W')) lon = -lon;

    if (!isNaN(lat) && !isNaN(lon)) {
      return { latitude: lat, longitude: lon };
    }
  } catch (err) {
    console.warn('[Coordinate Parse Error]:', err);
  }
  return null;
}

/**
 * Service providing meteorological telemetry from Open-Meteo backend with graceful demo fallback
 */
export const weatherService = {
  /**
   * Returns all available preset meteorological stations
   */
  getLocations(): LocationData[] {
    return LOCATIONS;
  },

  /**
   * Returns preset location by ID
   */
  getLocationById(id: string): LocationData {
    const found = LOCATIONS.find(l => l.id === id);
    return found || LOCATIONS[0];
  },

  /**
   * Fetches real weather and hourly data for a registered location ID
   */
  async getWeatherByLocationId(locationId: string): Promise<WeatherFetchResult> {
    const preset = this.getLocationById(locationId);

    const lat = preset.latitude ?? parseCoordinateString(preset.coordinates)?.latitude ?? 12.9716;
    const lon = preset.longitude ?? parseCoordinateString(preset.coordinates)?.longitude ?? 77.5946;

    return this.getWeatherByCoordinates(lat, lon, {
      id: preset.id,
      name: preset.name,
      state: preset.state,
      coordinates: preset.coordinates
    });
  },

  /**
   * Fetches real weather from Open-Meteo backend via coordinates
   */
  async getWeatherByCoordinates(
    latitude: number,
    longitude: number,
    meta?: { id?: string; name?: string; state?: string; coordinates?: string }
  ): Promise<WeatherFetchResult> {
    const fallbackPreset = meta?.id ? this.getLocationById(meta.id) : LOCATIONS[0];

    const locationMeta = {
      id: meta?.id || `custom-${latitude.toFixed(2)}-${longitude.toFixed(2)}`,
      name: meta?.name || fallbackPreset.name,
      state: meta?.state || fallbackPreset.state,
      coordinates:
        meta?.coordinates ||
        `${Math.abs(latitude).toFixed(2)}° ${latitude >= 0 ? 'N' : 'S'}, ${Math.abs(longitude).toFixed(2)}° ${longitude >= 0 ? 'E' : 'W'}`,
      latitude,
      longitude
    };

    try {
      const response = await fetch(
        `/api/weather?latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}`
      );

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      const payload = await response.json();

      if (!payload.weather) {
        throw new Error('Invalid weather payload received from backend');
      }

      const normalized = normalizeOpenMeteoResponse(payload, locationMeta, fallbackPreset);

      return {
        location: {
          ...normalized.location,
          isLive: true,
          dataSource: 'Open-Meteo'
        },
        hourly: normalized.hourly,
        isLive: true
      };
    } catch (error: any) {
      console.warn(
        `[WeatherService Notice]: Backend request failed (${error?.message || error}). Using demo fallback.`,
        error
      );

      return {
        location: {
          ...fallbackPreset,
          id: locationMeta.id,
          name: locationMeta.name,
          state: locationMeta.state,
          coordinates: locationMeta.coordinates,
          isLive: false,
          dataSource: 'Demo Data (Fallback)'
        },
        hourly: HOURLY_FORECAST_DATA,
        isLive: false,
        error: error?.message || 'Unable to connect to weather backend'
      };
    }
  },

  /**
   * Retrieves current weather LocationData (conforming to clean interface)
   */
  async getCurrentWeather(locationId: string): Promise<LocationData> {
    const result = await this.getWeatherByLocationId(locationId);
    return result.location;
  },

  /**
   * Retrieves hourly forecast items (conforming to clean interface)
   */
  async getHourlyForecast(locationId: string): Promise<HourlyForecastItem[]> {
    const result = await this.getWeatherByLocationId(locationId);
    return result.hourly;
  },

  /**
   * Reverse geocodes coordinates into city/state/country via backend proxy
   */
  async reverseGeocode(latitude: number, longitude: number): Promise<GeocodeResult> {
    try {
      const res = await fetch(
        `/api/geocode/reverse?latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}`
      );
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn('[Reverse Geocode Notice]: Using fallback location name', err);
    }
    return {
      name: 'Current Location',
      state: '',
      country: '',
      displayName: 'Current Location'
    };
  },

  /**
   * Active severe weather bulletin
   */
  getActiveAlerts(_locationId?: string): WeatherAlert | null {
    return ACTIVE_ALERT;
  },

  /**
   * Search registered locations
   */
  searchLocations(query: string): LocationData[] {
    const q = query.toLowerCase().trim();
    if (!q) return LOCATIONS;
    return LOCATIONS.filter(
      l =>
        l.name.toLowerCase().includes(q) ||
        l.state.toLowerCase().includes(q) ||
        l.condition.toLowerCase().includes(q)
    );
  },

  /**
   * Dynamic location geocoding search using backend Open-Meteo geocoding proxy
   */
  async searchLocationsRemote(query: string): Promise<RemoteLocationResult[]> {
    const q = query.trim();
    if (!q || q.length < 2) return [];

    try {
      const res = await fetch(`/api/geocode/search?q=${encodeURIComponent(q)}`);
      if (!res.ok) {
        throw new Error(`Geocoding search failed (HTTP ${res.status})`);
      }
      const data = await res.json();
      if (Array.isArray(data)) {
        return data;
      }
      return [];
    } catch (err: any) {
      console.warn('[Remote Location Search Error]:', err?.message || err);
      throw err;
    }
  }
};
