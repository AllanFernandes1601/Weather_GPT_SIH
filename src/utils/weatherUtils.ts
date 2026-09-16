import { HourlyForecastItem, LocationData, RainPrediction } from '../types';

/**
 * Maps WMO weather interpretation codes to human-readable condition text and Material Symbols icon name.
 * Reference: Open-Meteo WMO weather interpretation codes.
 */
export interface WmoWeatherInfo {
  condition: string;
  icon: string;
  isRain: boolean;
  isStorm: boolean;
}

export function getWeatherInfoFromWmoCode(code: number, isDay: boolean = true): WmoWeatherInfo {
  switch (code) {
    case 0:
      return {
        condition: isDay ? 'Clear Sky' : 'Clear Night',
        icon: isDay ? 'wb_sunny' : 'bedtime',
        isRain: false,
        isStorm: false
      };
    case 1:
      return {
        condition: 'Mainly Clear',
        icon: isDay ? 'partly_cloudy_day' : 'bedtime',
        isRain: false,
        isStorm: false
      };
    case 2:
      return {
        condition: 'Partly Cloudy',
        icon: isDay ? 'partly_cloudy_day' : 'cloud',
        isRain: false,
        isStorm: false
      };
    case 3:
      return {
        condition: 'Overcast',
        icon: 'cloud',
        isRain: false,
        isStorm: false
      };
    case 45:
    case 48:
      return {
        condition: 'Fog & Mist',
        icon: 'foggy',
        isRain: false,
        isStorm: false
      };
    case 51:
      return {
        condition: 'Light Drizzle',
        icon: 'rainy',
        isRain: true,
        isStorm: false
      };
    case 53:
      return {
        condition: 'Moderate Drizzle',
        icon: 'rainy',
        isRain: true,
        isStorm: false
      };
    case 55:
      return {
        condition: 'Dense Drizzle',
        icon: 'rainy',
        isRain: true,
        isStorm: false
      };
    case 56:
    case 57:
      return {
        condition: 'Freezing Drizzle',
        icon: 'weather_mix',
        isRain: true,
        isStorm: false
      };
    case 61:
      return {
        condition: 'Slight Rain',
        icon: 'rainy',
        isRain: true,
        isStorm: false
      };
    case 63:
      return {
        condition: 'Moderate Rain',
        icon: 'rainy',
        isRain: true,
        isStorm: false
      };
    case 65:
      return {
        condition: 'Heavy Rain',
        icon: 'rainy_heavy',
        isRain: true,
        isStorm: false
      };
    case 66:
    case 67:
      return {
        condition: 'Freezing Rain',
        icon: 'weather_mix',
        isRain: true,
        isStorm: false
      };
    case 71:
    case 73:
    case 75:
      return {
        condition: 'Snowfall',
        icon: 'ac_unit',
        isRain: false,
        isStorm: false
      };
    case 77:
      return {
        condition: 'Snow Grains',
        icon: 'ac_unit',
        isRain: false,
        isStorm: false
      };
    case 80:
      return {
        condition: 'Light Showers',
        icon: 'rainy',
        isRain: true,
        isStorm: false
      };
    case 81:
      return {
        condition: 'Scattered Showers',
        icon: 'rainy',
        isRain: true,
        isStorm: false
      };
    case 82:
      return {
        condition: 'Violent Showers',
        icon: 'rainy_heavy',
        isRain: true,
        isStorm: false
      };
    case 85:
    case 86:
      return {
        condition: 'Snow Showers',
        icon: 'ac_unit',
        isRain: false,
        isStorm: false
      };
    case 95:
      return {
        condition: 'Thunderstorm',
        icon: 'thunderstorm',
        isRain: true,
        isStorm: true
      };
    case 96:
    case 99:
      return {
        condition: 'Thunderstorm with Hail',
        icon: 'thunderstorm',
        isRain: true,
        isStorm: true
      };
    default:
      return {
        condition: 'Partly Cloudy',
        icon: 'partly_cloudy_day',
        isRain: false,
        isStorm: false
      };
  }
}

/**
 * Converts wind degrees into 16-point cardinal compass text
 */
export function degreesToCompass(deg: number): string {
  if (isNaN(deg)) return 'Calm';
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(deg / 22.5) % 16;
  return directions[index];
}

/**
 * Returns descriptive UV category
 */
export function getUvCategory(uv: number): string {
  if (uv <= 2) return 'Low';
  if (uv <= 5) return 'Moderate';
  if (uv <= 7) return 'High';
  if (uv <= 10) return 'Very High';
  return 'Extreme';
}

/**
 * Formats ISO date string (e.g. "2026-09-14T06:08") to 12-hour readable format ("6:08 AM")
 */
export function formatTime12H(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  } catch {
    return isoString;
  }
}

/**
 * Determines whether a given time is daytime by comparing with the location's actual sunrise and sunset times.
 * Avoids any hard-coded hour checks.
 */
export function isDaytimeFromSolar(
  targetTimeIso?: string,
  sunriseTimes?: string[],
  sunsetTimes?: string[],
  directIsDay?: number | boolean
): boolean {
  // If Open-Meteo provided a direct is_day flag (1 = day, 0 = night)
  if (directIsDay !== undefined && directIsDay !== null) {
    return Boolean(directIsDay);
  }

  if (!targetTimeIso) return true;

  // Compare using actual sunrise and sunset values returned by Open-Meteo for that day
  if (sunriseTimes && sunsetTimes && sunriseTimes.length > 0 && sunsetTimes.length > 0) {
    const targetDateStr = targetTimeIso.slice(0, 10); // "YYYY-MM-DD"
    const dayIdx = sunriseTimes.findIndex((s) => s && s.startsWith(targetDateStr));
    const sunriseStr = dayIdx !== -1 ? sunriseTimes[dayIdx] : sunriseTimes[0];
    const sunsetStr = dayIdx !== -1 ? sunsetTimes[dayIdx] : sunsetTimes[0];

    if (sunriseStr && sunsetStr) {
      // Both strings are ISO format in the same station timezone (e.g. "2026-09-14T06:08")
      return targetTimeIso >= sunriseStr && targetTimeIso < sunsetStr;
    }
  }

  // Graceful fallback if solar records are missing
  try {
    const hour = parseInt(targetTimeIso.slice(11, 13), 10);
    return hour >= 6 && hour < 19;
  } catch {
    return true;
  }
}

/**
 * Finds the index in hourly.time matching the location's current time.
 * Compares station local ISO hours rather than using arbitrary browser hour numbers.
 */
export function findCurrentHourlyIndex(
  hourlyTimes: string[] = [],
  currentTimeIso?: string,
  utcOffsetSeconds: number = 0
): number {
  if (!hourlyTimes || hourlyTimes.length === 0) return 0;

  // 1. If Open-Meteo provided current.time (e.g. "2026-09-14T22:30")
  if (currentTimeIso) {
    // Both currentTimeIso and hourlyTimes are formatted without offset in station local time
    const targetHourPrefix = currentTimeIso.slice(0, 13); // "2026-09-14T22"
    const prefixIdx = hourlyTimes.findIndex((t) => t.startsWith(targetHourPrefix));
    if (prefixIdx !== -1) return prefixIdx;

    // Nearest timestamp match by converting to epoch
    const targetMs = new Date(currentTimeIso).getTime();
    if (!isNaN(targetMs)) {
      let closestIdx = 0;
      let minDiff = Infinity;
      for (let i = 0; i < hourlyTimes.length; i++) {
        const diff = Math.abs(new Date(hourlyTimes[i]).getTime() - targetMs);
        if (diff < minDiff) {
          minDiff = diff;
          closestIdx = i;
        }
      }
      return closestIdx;
    }
  }

  // 2. If current.time is not provided, calculate local station time from UTC offset
  const nowUtc = Date.now();
  const stationLocalMs = nowUtc + utcOffsetSeconds * 1000;
  const stationLocalIso = new Date(stationLocalMs).toISOString().slice(0, 13);
  const offsetIdx = hourlyTimes.findIndex((t) => t.startsWith(stationLocalIso));
  if (offsetIdx !== -1) return offsetIdx;

  return 0;
}

/**
 * Calculates daylight duration string and solar progress percentage using station times.
 */
export function calculateSolarCycle(sunriseIso?: string, sunsetIso?: string, currentTimeIso?: string) {
  if (!sunriseIso || !sunsetIso) {
    return {
      daylightDuration: '12h 30m Daylight',
      sunrise: '6:00 AM',
      sunset: '6:30 PM',
      progressPercentage: 50
    };
  }

  try {
    const sunriseDate = new Date(sunriseIso);
    const sunsetDate = new Date(sunsetIso);
    const nowTime = currentTimeIso ? new Date(currentTimeIso) : new Date();

    const diffMs = sunsetDate.getTime() - sunriseDate.getTime();
    const totalMinutes = Math.max(0, Math.floor(diffMs / (1000 * 60)));
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    const daylightDuration = `${hours}h ${mins}m Daylight`;

    let progress = 0;
    if (nowTime.getTime() < sunriseDate.getTime()) {
      progress = 0;
    } else if (nowTime.getTime() > sunsetDate.getTime()) {
      progress = 100;
    } else {
      const elapsedMs = nowTime.getTime() - sunriseDate.getTime();
      progress = Math.min(100, Math.max(0, Math.round((elapsedMs / diffMs) * 100)));
    }

    return {
      daylightDuration,
      sunrise: formatTime12H(sunriseIso),
      sunset: formatTime12H(sunsetIso),
      progressPercentage: progress
    };
  } catch {
    return {
      daylightDuration: '12h 30m Daylight',
      sunrise: '6:00 AM',
      sunset: '6:30 PM',
      progressPercentage: 50
    };
  }
}

/**
 * Normalizes Open-Meteo response into WeatherGPT LocationData and HourlyForecastItem[]
 */
export function normalizeOpenMeteoResponse(
  data: { weather: any; airQuality?: any; rainPrediction?: RainPrediction | null; cached?: boolean },
  locationMeta: {
    id: string;
    name: string;
    state: string;
    coordinates: string;
    latitude: number;
    longitude: number;
  },
  fallbackData?: LocationData
): { location: LocationData; hourly: HourlyForecastItem[] } {
  const current = data.weather?.current || {};
  const daily = data.weather?.daily || {};
  const hourly = data.weather?.hourly || {};
  const aqCurrent = data.airQuality?.current;
  const hourlyTimes: string[] = hourly.time || [];

  // 1. Find the accurate hourly index corresponding to current time
  const currentHourlyIndex = findCurrentHourlyIndex(
    hourlyTimes,
    current.time,
    data.weather?.utc_offset_seconds || 0
  );

  // 2. Determine day vs night from Open-Meteo actual sunrise/sunset and is_day flag
  const isDay = isDaytimeFromSolar(
    current.time,
    daily.sunrise,
    daily.sunset,
    current.is_day
  );

  // 3. Current weather code and conditions
  const weatherCode = current.weather_code ?? hourly.weather_code?.[currentHourlyIndex] ?? 0;
  const weatherInfo = getWeatherInfoFromWmoCode(weatherCode, isDay);

  // 4. Atmospheric measurements: use direct current observation, or hourly at current index
  const temperature = Math.round(
    current.temperature_2m ?? hourly.temperature_2m?.[currentHourlyIndex] ?? fallbackData?.temperature ?? 27
  );
  const feelsLike = Math.round(
    current.apparent_temperature ?? hourly.apparent_temperature?.[currentHourlyIndex] ?? fallbackData?.feelsLike ?? temperature
  );
  const high = Math.round(daily.temperature_2m_max?.[0] ?? fallbackData?.high ?? temperature + 3);
  const low = Math.round(daily.temperature_2m_min?.[0] ?? fallbackData?.low ?? temperature - 6);

  const humidity = Math.round(
    current.relative_humidity_2m ?? hourly.relative_humidity_2m?.[currentHourlyIndex] ?? fallbackData?.humidity ?? 65
  );
  let humidityDesc = 'Comfortable air';
  if (humidity < 40) humidityDesc = 'Dry air';
  else if (humidity > 75) humidityDesc = 'Moist air';
  else if (humidity > 85) humidityDesc = 'High humidity';

  const windSpeed = Math.round(
    current.wind_speed_10m ?? hourly.wind_speed_10m?.[currentHourlyIndex] ?? fallbackData?.windSpeed ?? 10
  );
  const windDirectionDeg = current.wind_direction_10m ?? hourly.wind_direction_10m?.[currentHourlyIndex] ?? 0;
  const windDirection = degreesToCompass(windDirectionDeg);
  const windGusts = Math.round(current.wind_gusts_10m ?? hourly.wind_gusts_10m?.[currentHourlyIndex] ?? windSpeed * 1.4);

  const uvIndex = Math.round(current.uv_index ?? hourly.uv_index?.[currentHourlyIndex] ?? 0);
  const uvCategory = getUvCategory(uvIndex);

  // Visibility in km (Open-Meteo returns meters)
  const visibilityMeters = current.visibility ?? hourly.visibility?.[currentHourlyIndex] ?? 10000;
  const visibility = Math.round(visibilityMeters / 1000);

  const pressure = Math.round(
    current.surface_pressure ?? hourly.surface_pressure?.[currentHourlyIndex] ?? fallbackData?.pressure ?? 1012
  );

  // Pressure tendency calculation from hourly data if present
  let pressureTendency = 'hPa • Stable';
  if (hourly.surface_pressure && hourly.surface_pressure.length > currentHourlyIndex + 3) {
    const diff = hourly.surface_pressure[currentHourlyIndex + 3] - hourly.surface_pressure[currentHourlyIndex];
    if (diff > 1) pressureTendency = 'hPa • Rising';
    else if (diff < -1) pressureTendency = 'hPa • Falling';
  }

  // Greeting based on station hour
  const stationHour = current.time ? parseInt(current.time.slice(11, 13), 10) : new Date().getHours();
  let greetingPeriod = 'evening';
  if (stationHour >= 5 && stationHour < 12) greetingPeriod = 'morning';
  else if (stationHour >= 12 && stationHour < 17) greetingPeriod = 'afternoon';
  else if (stationHour >= 17 && stationHour < 21) greetingPeriod = 'evening';
  else greetingPeriod = 'night';
  const greeting = stationHour >= 21 || stationHour < 5 ? `Good night, ${locationMeta.name}` : `Good ${greetingPeriod}, ${locationMeta.name}`;

  // Solar cycle with station time
  const solarCycle = calculateSolarCycle(daily.sunrise?.[0], daily.sunset?.[0], current.time);

  // Air Quality
  let airQuality = fallbackData?.airQuality || {
    aqi: 55,
    status: 'Satisfactory',
    pm25: 16,
    pm10: 38,
    description: 'Good air movement supporting clean atmospheric conditions.'
  };

  if (aqCurrent) {
    const aqiVal = Math.round(aqCurrent.us_aqi ?? aqCurrent.european_aqi ?? 50);
    let aqiStatus = 'Good';
    let aqiDesc = 'Air quality is considered satisfactory, and air pollution poses little or no risk.';

    if (aqiVal > 200) {
      aqiStatus = 'Very Unhealthy';
      aqiDesc = 'Health alert: everyone may experience more serious health effects.';
    } else if (aqiVal > 150) {
      aqiStatus = 'Unhealthy';
      aqiDesc = 'Everyone may begin to experience health effects; sensitive groups more serious.';
    } else if (aqiVal > 100) {
      aqiStatus = 'Moderate';
      aqiDesc = 'Acceptable quality; sensitive individuals should consider limiting prolonged exertion.';
    } else if (aqiVal > 50) {
      aqiStatus = 'Satisfactory';
      aqiDesc = 'Air quality is acceptable for outdoor activities with low sensitivities.';
    }

    airQuality = {
      aqi: aqiVal,
      status: aqiStatus,
      pm25: Math.round(aqCurrent.pm2_5 ?? 15),
      pm10: Math.round(aqCurrent.pm10 ?? 35),
      description: aqiDesc
    };
  }

  // Precipitation & Dew
  const dailyTotalMm = parseFloat((daily.precipitation_sum?.[0] ?? current.precipitation ?? 0).toFixed(1));

  // Consistent hourly index lookup for dew point
  const dewPoint = hourly.dew_point_2m?.[currentHourlyIndex] !== undefined
    ? Math.round(hourly.dew_point_2m[currentHourlyIndex])
    : Math.round(temperature - (100 - humidity) / 5);

  let precipitationDesc = 'Standard moisture equilibrium.';
  if (weatherInfo.isRain) {
    precipitationDesc = 'Precipitation detected in regional atmospheric observations.';
  } else if (humidity > 75) {
    precipitationDesc = 'Elevated atmospheric humidity.';
  } else {
    precipitationDesc = 'Dry atmospheric column restricting rain cloud formation.';
  }

  const location: LocationData = {
    id: locationMeta.id,
    name: locationMeta.name,
    state: locationMeta.state,
    coordinates: locationMeta.coordinates,
    rainPrediction: data.rainPrediction ?? null,
    temperature,
    condition: weatherInfo.condition,
    weatherIcon: weatherInfo.icon,
    isDay,
    feelsLike,
    high,
    low,
    greeting,
    humidity,
    humidityDesc,
    windSpeed,
    windDirection,
    windGusts,
    uvIndex,
    uvCategory,
    visibility,
    pressure,
    pressureTendency,
    // Strictly mark fields that Open-Meteo does not provide as "Not available"
    radarStation: 'Not available',
    convectiveCell: 'Not available',
    airQuality,
    solarCycle,
    precipitation: {
      dailyTotalMm,
      dewPoint,
      // moistureFlux is omitted / undefined because Open-Meteo does not measure it
      description: precipitationDesc
    }
  };

  // Build Hourly Forecast Items starting from the current hourly index
  const hourlyItems: HourlyForecastItem[] = [];
  const temps: number[] = hourly.temperature_2m || [];
  const pops: number[] = hourly.precipitation_probability || [];
  const codes: number[] = hourly.weather_code || [];
  const hourlyIsDays: number[] = hourly.is_day || [];

  const startIdx = currentHourlyIndex;
  // Keep enough live hours for questions about the rest of today and tomorrow.
  // The dashboard component limits how many cards it displays.
  const itemsCount = Math.min(48, Math.max(0, hourlyTimes.length - startIdx));

  for (let i = 0; i < itemsCount; i++) {
    const idx = startIdx + i;
    const timeIso = hourlyTimes[idx];
    const itemDate = new Date(timeIso);
    const itemHour = itemDate.getHours();

    // Determine day vs night using actual sunrise/sunset values for that day
    const itemIsDay = isDaytimeFromSolar(
      timeIso,
      daily.sunrise,
      daily.sunset,
      hourlyIsDays[idx]
    );

    const itemCode = codes[idx] ?? 0;
    const itemInfo = getWeatherInfoFromWmoCode(itemCode, itemIsDay);
    const rainProb = pops[idx] ?? 0;

    let timeLabel = 'Now';
    if (i > 0) {
      const h12 = itemHour % 12 === 0 ? 12 : itemHour % 12;
      const ampm = itemHour >= 12 ? 'PM' : 'AM';
      timeLabel = `${h12} ${ampm}`;
    }

    hourlyItems.push({
      time: timeLabel,
      forecastTime: timeIso,
      temperature: Math.round(temps[idx] ?? temperature),
      condition: itemInfo.condition,
      rainProbability: rainProb,
      icon: itemInfo.icon,
      isNow: i === 0,
      isWarning: rainProb >= 50 && rainProb < 75,
      isPeakStorm: rainProb >= 75 || itemInfo.isStorm
    });
  }

  // Fallback to mock hourly items if empty
  const finalHourly = hourlyItems.length >= 4 ? hourlyItems : (fallbackData ? [
    {
      time: 'Now',
      temperature,
      condition: weatherInfo.condition,
      rainProbability: 10,
      icon: weatherInfo.icon,
      isNow: true
    }
  ] : []);

  return { location, hourly: finalHourly };
}
