import { AlertSeverity } from './types';

/**
 * Weather Alert Engine Thresholds & Reference Criteria.
 *
 * CRITICAL ARCHITECTURAL DISTINCTION:
 * This configuration explicitly distinguishes between two concepts:
 * 1. Source-aligned meteorological reference categories (e.g. IMD 24h rainfall accumulation bands,
 *    IMD actual temperature criteria for plains, CPCB National Air Quality Index bands).
 * 2. WeatherGPT configurable operational triggers used by the prototype alert engine to determine
 *    when proactive SMS advisories should be emitted to subscribers.
 *
 * WeatherGPT operational triggers MUST NOT be claimed as official statutory warnings issued by
 * IMD, CPCB, or NDMA.
 */

// =========================================================================
// 1. OFFICIAL / SOURCE-ALIGNED REFERENCE CRITERIA
// =========================================================================

/**
 * India Meteorological Department (IMD) 24-hour cumulative rainfall categories.
 * Standard IMD descriptive bands for 24-hour cumulative precipitation (mm/24h).
 */
export const IMD_24H_RAINFALL_REFERENCE = {
  veryLightRainMm: { min: 0.1, max: 2.4, label: 'Very Light Rain' },
  lightRainMm: { min: 2.5, max: 15.5, label: 'Light Rain' },
  moderateRainMm: { min: 15.6, max: 64.4, label: 'Moderate Rain' },
  heavyRainMm: { min: 64.5, max: 115.5, label: 'Heavy Rain' },
  veryHeavyRainMm: { min: 115.6, max: 204.4, label: 'Very Heavy Rain' },
  extremelyHeavyRainMm: { min: 204.5, label: 'Extremely Heavy Rain' }
} as const;

/**
 * IMD Heat Wave Reference Criteria (Actual Maximum Temperature for Indian Plains).
 * Note: An official IMD heat wave declaration additionally requires departure from normal
 * (>= 4.5°C departure) or actual maximum reaching >= 45°C.
 */
export const IMD_HEAT_WAVE_PLAINS_REFERENCE = {
  plainsEligibilityMinC: 40.0,
  heatWaveActualMaxC: 45.0,
  severeHeatWaveActualMaxC: 47.0
} as const;

/**
 * Central Pollution Control Board (CPCB) India National Air Quality Index (NAQI) bands.
 * Standard 6-category scale defined by CPCB.
 */
export const CPCB_AQI_BANDS = {
  good: { min: 0, max: 50, label: 'Good' },
  satisfactory: { min: 51, max: 100, label: 'Satisfactory' },
  moderatelyPolluted: { min: 101, max: 200, label: 'Moderately Polluted' },
  poor: { min: 201, max: 300, label: 'Poor' },
  veryPoor: { min: 301, max: 400, label: 'Very Poor' },
  severe: { min: 401, max: 500, label: 'Severe' }
} as const;

// =========================================================================
// 2. WEATHERGPT CONFIGURABLE OPERATIONAL TRIGGERS
// =========================================================================

export interface AlertThresholdConfig {
  heavyRain: {
    // Short-duration rainfall rate in mm/hour (burst intensity)
    rainfallIntensityMmPerHour: {
      moderate: number; // e.g. 15 mm/h
      high: number;     // e.g. 35 mm/h
      severe: number;   // e.g. 65 mm/h
    };
    // 24-hour cumulative rainfall accumulation in mm (broadly aligned with IMD accumulation bands)
    rainfallAccumulation24hMm: {
      moderate: number; // 35.5 mm (upper moderate)
      high: number;     // 64.5 mm (aligned with IMD Heavy Rain threshold: >= 64.5 mm)
      severe: number;   // 115.6 mm (aligned with IMD Very Heavy Rain threshold: >= 115.6 mm)
    };
    // WMO interpretation codes indicative of intense short-duration precipitation
    wmoCodes: {
      heavy: number[];  // [65, 82]
    };
  };

  thunderstorm: {
    wmoCodes: {
      moderate: number[]; // e.g. [95] (Thunderstorm)
      severe: number[];   // e.g. [96, 99] (Thunderstorm with hail)
    };
    windGustMinKmH: number; // Minimum associated wind gust in km/h for escalation
  };

  strongWind: {
    // WeatherGPT operational triggers in km/h (sustained and peak gusts)
    windSpeedKmH: {
      moderate: number; // 40 km/h
      high: number;     // 55 km/h
      severe: number;   // 75 km/h
    };
    windGustKmH: {
      moderate: number; // 55 km/h
      high: number;     // 75 km/h
      severe: number;   // 90 km/h
    };
  };

  extremeHeat: {
    // WeatherGPT operational triggers in °C (Provisional triggers, not official IMD declarations)
    temperatureC: {
      moderate: number; // 38 °C (early advisory)
      high: number;     // 41 °C (plains advisory)
      severe: number;   // 45 °C (aligned with IMD actual max threshold)
    };
    apparentTemperatureC: {
      moderate: number; // 43 °C
      high: number;     // 47 °C
      severe: number;   // 52 °C
    };
  };

  extremeCold: {
    // WeatherGPT operational triggers in °C (Provisional triggers, not official IMD declarations)
    temperatureC: {
      moderate: number; // 7 °C
      high: number;     // 4 °C
      severe: number;   // 2 °C
    };
  };

  airQuality: {
    // Primary: CPCB India National AQI (0-500 scale)
    cpcbAqi: {
      moderate: number; // 101 (Moderately Polluted: 101-200)
      high: number;     // 201 (Poor: 201-300)
      severe: number;   // 301 (Very Poor / Severe: >= 301)
    };
    // Fallback: US EPA AQI (0-500 scale, used only when Indian AQI is not provided)
    usAqiFallback: {
      moderate: number; // 150
      high: number;     // 200
      severe: number;   // 300
    };
    // Direct particulate concentrations (µg/m³) aligned with CPCB 24h standards
    pm25: {
      moderate: number; // 60 µg/m³ (CPCB 24h standard)
      high: number;     // 120 µg/m³
      severe: number;   // 250 µg/m³
    };
    pm10: {
      moderate: number; // 100 µg/m³ (CPCB 24h standard)
      high: number;     // 250 µg/m³
      severe: number;   // 350 µg/m³
    };
  };

  forecastHorizonHours: number;
  defaultAffectedRadiusKm: Record<string, number>;
}

/**
 * Default prototype operational thresholds.
 */
export const DEFAULT_ALERT_THRESHOLDS: AlertThresholdConfig = {
  heavyRain: {
    rainfallIntensityMmPerHour: {
      moderate: 15,
      high: 35,
      severe: 65
    },
    rainfallAccumulation24hMm: {
      moderate: 35.5,
      high: 64.5,
      severe: 115.6
    },
    wmoCodes: {
      heavy: [65, 82] // WMO 65: Heavy rain; WMO 82: Violent rain showers
    }
  },
  thunderstorm: {
    wmoCodes: {
      moderate: [95],
      severe: [96, 99]
    },
    windGustMinKmH: 45
  },
  strongWind: {
    windSpeedKmH: {
      moderate: 40,
      high: 55,
      severe: 75
    },
    windGustKmH: {
      moderate: 55,
      high: 75,
      severe: 90
    }
  },
  extremeHeat: {
    temperatureC: {
      moderate: 38,
      high: 41,
      severe: 45
    },
    apparentTemperatureC: {
      moderate: 43,
      high: 47,
      severe: 52
    }
  },
  extremeCold: {
    temperatureC: {
      moderate: 7,
      high: 4,
      severe: 2
    }
  },
  airQuality: {
    cpcbAqi: {
      moderate: 101, // 101-200 Moderately Polluted
      high: 201,     // 201-300 Poor
      severe: 301    // 301+ Very Poor / Severe
    },
    usAqiFallback: {
      moderate: 150,
      high: 200,
      severe: 300
    },
    pm25: {
      moderate: 60,
      high: 120,
      severe: 250
    },
    pm10: {
      moderate: 100,
      high: 250,
      severe: 350
    }
  },
  forecastHorizonHours: 24,
  defaultAffectedRadiusKm: {
    heavy_rain: 20,
    thunderstorm: 25,
    strong_wind: 35,
    extreme_heat: 50,
    extreme_cold: 50,
    air_quality: 30,
    flood: 25,
    other: 20
  }
};

/**
 * Numeric rank for severity ordering and comparison.
 */
export const SEVERITY_RANK: Record<AlertSeverity, number> = {
  low: 0,
  moderate: 1,
  high: 2,
  severe: 3
};

/**
 * Returns true if severity `a` is greater than or equal to severity `b`.
 */
export function isSeverityGte(a: AlertSeverity, b: AlertSeverity): boolean {
  return SEVERITY_RANK[a] >= SEVERITY_RANK[b];
}

/**
 * Returns the higher of two severities.
 */
export function maxSeverity(a: AlertSeverity, b: AlertSeverity): AlertSeverity {
  return SEVERITY_RANK[a] >= SEVERITY_RANK[b] ? a : b;
}
