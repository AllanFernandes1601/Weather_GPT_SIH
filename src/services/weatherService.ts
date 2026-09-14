import { LocationData, HourlyForecastItem, WeatherAlert } from '../types';
import { LOCATIONS, HOURLY_FORECAST_DATA, ACTIVE_ALERT } from '../data/mockWeatherData';

/**
 * Service to retrieve meteorological data.
 * Designed to cleanly swap in real weather APIs (Open-Meteo, IMD API, etc.) in the future.
 */
export const weatherService = {
  getLocations(): LocationData[] {
    return LOCATIONS;
  },

  getLocationById(id: string): LocationData {
    const found = LOCATIONS.find(l => l.id === id);
    return found || LOCATIONS[0];
  },

  getHourlyForecast(_locationId?: string): HourlyForecastItem[] {
    // Returns hourly forecast (mock data for now, ready for external API)
    return HOURLY_FORECAST_DATA;
  },

  getActiveAlerts(_locationId?: string): WeatherAlert | null {
    // Returns active weather advisories
    return ACTIVE_ALERT;
  },

  searchLocations(query: string): LocationData[] {
    const q = query.toLowerCase().trim();
    if (!q) return LOCATIONS;
    return LOCATIONS.filter(
      l =>
        l.name.toLowerCase().includes(q) ||
        l.state.toLowerCase().includes(q) ||
        l.condition.toLowerCase().includes(q)
    );
  }
};
