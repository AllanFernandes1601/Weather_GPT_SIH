import { LocationData, HourlyForecastItem, WeatherAlert, SuggestedQuestion } from '../types';

export const LOCATIONS: LocationData[] = [
  {
    id: 'bengaluru',
    name: 'Bengaluru',
    state: 'Karnataka',
    coordinates: '12.97° N, 77.59° E',
    latitude: 12.9716,
    longitude: 77.5946,
    isLive: false,
    dataSource: 'Demo Data (Fallback)',
    temperature: 28,
    condition: 'Partly Cloudy',
    weatherIcon: 'partly_cloudy_day',
    isDay: true,
    feelsLike: 30,
    high: 31,
    low: 21,
    greeting: 'Good afternoon, Bengaluru',
    humidity: 72,
    humidityDesc: 'Moist air',
    windSpeed: 12,
    windDirection: 'NW',
    windGusts: 18,
    uvIndex: 4,
    uvCategory: 'Moderate',
    visibility: 8,
    pressure: 1012,
    pressureTendency: 'hPa • Stable',
    radarStation: 'Not available',
    convectiveCell: 'Not available',
    airQuality: {
      aqi: 68,
      status: 'Satisfactory',
      pm25: 18,
      pm10: 42,
      description: 'Good day for outdoor activities, mild sensitivities only.'
    },
    solarCycle: {
      daylightDuration: '12h 38m Daylight',
      sunrise: '6:04 AM',
      sunset: '6:42 PM',
      progressPercentage: 64
    },
    precipitation: {
      dailyTotalMm: 4.2,
      dewPoint: 22,
      description: 'High surface moisture conducive to rapid afternoon cloud development.'
    }
  },
  {
    id: 'mumbai',
    name: 'Mumbai',
    state: 'Maharashtra',
    coordinates: '19.07° N, 72.87° E',
    latitude: 19.0760,
    longitude: 72.8777,
    isLive: false,
    dataSource: 'Demo Data (Fallback)',
    temperature: 31,
    condition: 'Humid & Overcast',
    weatherIcon: 'cloud',
    isDay: true,
    feelsLike: 36,
    high: 33,
    low: 26,
    greeting: 'Good afternoon, Mumbai',
    humidity: 84,
    humidityDesc: 'Very humid coastal air',
    windSpeed: 18,
    windDirection: 'WSW',
    windGusts: 26,
    uvIndex: 6,
    uvCategory: 'High',
    visibility: 6,
    pressure: 1008,
    pressureTendency: 'hPa • Steady',
    radarStation: 'Not available',
    convectiveCell: 'Not available',
    airQuality: {
      aqi: 92,
      status: 'Moderate',
      pm25: 32,
      pm10: 68,
      description: 'Acceptable air quality; sensitive groups should consider limiting prolonged outdoor exertion.'
    },
    solarCycle: {
      daylightDuration: '12h 45m Daylight',
      sunrise: '6:18 AM',
      sunset: '7:03 PM',
      progressPercentage: 58
    },
    precipitation: {
      dailyTotalMm: 12.8,
      dewPoint: 25,
      description: 'Arabian sea moisture stream maintaining elevated humidity and intermittent showers.'
    }
  },
  {
    id: 'delhi',
    name: 'Delhi NCR',
    state: 'National Capital Region',
    coordinates: '28.61° N, 77.20° E',
    latitude: 28.6139,
    longitude: 77.2090,
    isLive: false,
    dataSource: 'Demo Data (Fallback)',
    temperature: 34,
    condition: 'Hazy Sun',
    weatherIcon: 'wb_sunny',
    isDay: true,
    feelsLike: 37,
    high: 36,
    low: 24,
    greeting: 'Good afternoon, Delhi NCR',
    humidity: 48,
    humidityDesc: 'Moderate dryness',
    windSpeed: 10,
    windDirection: 'E',
    windGusts: 15,
    uvIndex: 7,
    uvCategory: 'Very High',
    visibility: 4,
    pressure: 1006,
    pressureTendency: 'hPa • Falling',
    radarStation: 'Not available',
    convectiveCell: 'Not available',
    airQuality: {
      aqi: 142,
      status: 'Moderate to Poor',
      pm25: 58,
      pm10: 114,
      description: 'Breathing discomfort to sensitive individuals and persons with respiratory illness.'
    },
    solarCycle: {
      daylightDuration: '12h 55m Daylight',
      sunrise: '5:58 AM',
      sunset: '6:53 PM',
      progressPercentage: 62
    },
    precipitation: {
      dailyTotalMm: 0.0,
      dewPoint: 19,
      description: 'Dry continental air currently restricting localized precipitation.'
    }
  },
  {
    id: 'chennai',
    name: 'Chennai',
    state: 'Tamil Nadu',
    coordinates: '13.08° N, 80.27° E',
    latitude: 13.0827,
    longitude: 80.2707,
    isLive: false,
    dataSource: 'Demo Data (Fallback)',
    temperature: 32,
    condition: 'Scattered Clouds',
    weatherIcon: 'partly_cloudy_day',
    isDay: true,
    feelsLike: 38,
    high: 34,
    low: 27,
    greeting: 'Good afternoon, Chennai',
    humidity: 78,
    humidityDesc: 'Maritime moisture',
    windSpeed: 14,
    windDirection: 'SE',
    windGusts: 22,
    uvIndex: 8,
    uvCategory: 'Very High',
    visibility: 9,
    pressure: 1010,
    pressureTendency: 'hPa • Stable',
    radarStation: 'Not available',
    convectiveCell: 'Not available',
    airQuality: {
      aqi: 54,
      status: 'Satisfactory',
      pm25: 14,
      pm10: 36,
      description: 'Good air movement from Bay of Bengal supporting clean atmospheric conditions.'
    },
    solarCycle: {
      daylightDuration: '12h 30m Daylight',
      sunrise: '5:54 AM',
      sunset: '6:24 PM',
      progressPercentage: 66
    },
    precipitation: {
      dailyTotalMm: 1.5,
      dewPoint: 24,
      description: 'Evening coastal cloud condensation possible along arterial corridors.'
    }
  }
];

export const HOURLY_FORECAST_DATA: HourlyForecastItem[] = [
  {
    time: 'Now',
    temperature: 28,
    condition: 'Partly Cloudy',
    rainProbability: 10,
    icon: 'partly_cloudy_day',
    isNow: true
  },
  {
    time: '2 PM',
    temperature: 28,
    condition: 'Partly Cloudy',
    rainProbability: 30,
    icon: 'partly_cloudy_day'
  },
  {
    time: '3 PM',
    temperature: 27,
    condition: 'Scattered Showers',
    rainProbability: 60,
    icon: 'rainy',
    isWarning: true
  },
  {
    time: '4 PM',
    temperature: 27,
    condition: 'Thunderstorm',
    rainProbability: 75,
    icon: 'thunderstorm',
    isPeakStorm: true
  },
  {
    time: '5 PM',
    temperature: 26,
    condition: 'Heavy Rain',
    rainProbability: 70,
    icon: 'rainy_heavy',
    isWarning: true
  },
  {
    time: '6 PM',
    temperature: 25,
    condition: 'Easing Showers',
    rainProbability: 40,
    icon: 'weather_mix'
  },
  {
    time: '7 PM',
    temperature: 25,
    condition: 'Cloudy',
    rainProbability: 20,
    icon: 'cloud'
  },
  {
    time: '8 PM',
    temperature: 24,
    condition: 'Night Clear',
    rainProbability: 10,
    icon: 'bedtime'
  }
];

export const ACTIVE_ALERT: WeatherAlert = {
  id: 'alert-blr-24-08',
  severity: 'moderate',
  badgeText: 'Preparedness Scenario',
  bulletinRef: 'DEMO/BLR/RAIN',
  stage: 'Not a live warning',
  title: 'Demo: Heavy-rain commute preparedness',
  timeWindow: 'Example window: 3:30 PM – 8:00 PM IST',
  description:
    'Illustrative preparedness scenario for testing route-safety guidance. It is not sourced from a current IMD or municipal warning.',
  affectedCorridors: [
    'Outer Ring Road (Silk Board to Marathahalli)',
    'Bellandur EcoSpace Transit Cut',
    'Whitefield Main Road / ITPL Junction',
    'Sarjapur Road Low-Lying Underpasses'
  ],
  routePrecautions: [
    'Avoid parking in basement garages prone to backflow flooding.',
    'Adjust departure time if an official warning affects the route.',
    'Maintain a safe following distance on wet roads.',
    'Keep emergency power banks charged for navigation and alert updates.'
  ],
  safetyChecklist: [
    'Carry waterproof protective gear / rain poncho',
    'Verify metro rail schedules as a road transit alternate',
    'Avoid shelter under large old trees or fragile tin hoardings during gust spikes',
    'Report severe waterlogging to local municipal disaster helpline'
  ]
};

export const SUGGESTED_QUESTIONS: SuggestedQuestion[] = [
  {
    id: 'q1',
    text: 'Will it rain during my evening commute (5:30 PM)?',
    subtitle: 'Commute forecast & traffic buffer',
    icon: '🌧️',
    bgClass: 'bg-blue-50',
    borderClass: 'border-blue-200/60',
    mockAnswer: {
      summary:
        'Yes, moderate to heavy rainfall is projected between 4:00 PM and 6:30 PM with precipitation odds of 70%. Expect slower traffic on major arterial roads.',
      riskLevel: 'Moderate',
      timing: 'Peak shower window: 4:30 PM – 6:15 PM',
      actionItems: [
        'Consider leaving office before 4:00 PM or after 7:00 PM.',
        'Anticipate 25-40 min additional delay on arterial routes.',
        'Namma Metro is recommended for North-South and East-West corridors.'
      ]
    }
  },
  {
    id: 'q2',
    text: 'Is Outer Ring Road & Bellandur safe from waterlogging?',
    subtitle: 'Flooding susceptibility telemetry',
    icon: '🚗',
    bgClass: 'bg-amber-50',
    borderClass: 'border-amber-200/60',
    mockAnswer: {
      summary:
        'Moderate waterlogging risk detected around Bellandur EcoSpace and Marathahalli underpass between 4:30 PM and 7:00 PM. Slow-moving traffic expected.',
      riskLevel: 'High',
      timing: 'Water accumulation peak: 5:00 PM – 7:30 PM',
      actionItems: [
        'Prefer alternate elevated flyovers over surface service lanes.',
        'Two-wheeler commuters should exercise extreme caution at junction puddles.',
        'Monitor local traffic updates before starting.'
      ]
    }
  },
  {
    id: 'q3',
    text: 'Should I carry an umbrella tomorrow morning?',
    subtitle: 'Early morning precipitation odds',
    icon: '☂️',
    bgClass: 'bg-orange-50',
    borderClass: 'border-orange-200/60',
    mockAnswer: {
      summary:
        'Light overcast with 20% morning rain odds. Carrying a compact umbrella is recommended as scattered noon convective drizzle is likely.',
      riskLevel: 'Low',
      timing: 'Chance of drizzle: 11:30 AM onwards',
      actionItems: [
        'Compact folding umbrella is sufficient.',
        'Morning commute (8:00 AM - 10:30 AM) will remain predominantly dry.'
      ]
    }
  },
  {
    id: 'q4',
    text: 'What is the lightning risk in East Bengaluru today?',
    subtitle: 'Doppler convective cell tracking',
    icon: '⚡',
    bgClass: 'bg-amber-100',
    borderClass: 'border-amber-300',
    mockAnswer: {
      summary:
        'Convective cloud formations indicate isolated cloud-to-ground lightning discharge risk between 3:45 PM and 5:30 PM across Whitefield and KR Puram.',
      riskLevel: 'Moderate',
      timing: 'Lightning activity: 3:45 PM – 5:30 PM',
      actionItems: [
        'Avoid open sports grounds and terrace spaces during thunder.',
        'Do not shelter under isolated tall trees or electric poles.',
        'Unplug sensitive electronic hardware during direct thunderstorm periods.'
      ]
    }
  },
  {
    id: 'q5',
    text: '7-day monsoon advancement projection',
    subtitle: 'Synoptic scale weather patterns & agricultural rainfall outlook across Karnataka',
    icon: '📊',
    bgClass: 'bg-emerald-50',
    borderClass: 'border-emerald-200/60',
    colSpan: 'col-span-1 sm:col-span-2 lg:col-span-2',
    mockAnswer: {
      summary:
        'South-West monsoon currents remain active over South Interior Karnataka. Steady cumulative rainfall expected throughout the week, beneficial for catchment reservoirs.',
      riskLevel: 'Low',
      timing: 'Active monsoon pulse: Next 5-7 days',
      actionItems: [
        'Catchment areas expected to receive 45-65 mm cumulative precipitation.',
        'Agricultural moisture levels remain optimal for Kharif sowing.',
        'Coastal Karnataka likely to experience heavy coastal surges.'
      ]
    }
  }
];

export const EXPLORE_SECTIONS = [
  {
    id: 'forecast',
    title: 'Extended Forecast',
    description: '7-Day Synoptic outlook with probabilistic precipitation & temperature gradients.',
    icon: 'calendar_month',
    badge: '7-Day Outlook',
    badgeColor: 'bg-blue-50 text-blue-800 border-blue-200',
    accentColor: 'text-blue-600',
    route: 'forecast' as const
  },
  {
    id: 'weather-map',
    title: 'Interactive Weather Map',
    description: 'Precipitation radar simulation, cloud density layer, wind streamline vector fields.',
    icon: 'map',
    badge: 'Live Layers',
    badgeColor: 'bg-amber-50 text-amber-800 border-amber-200',
    accentColor: 'text-amber-600',
    route: 'weather-map' as const
  },
  {
    id: 'cyclone-sea',
    title: 'Cyclone & Sea Zones',
    description: 'Bay of Bengal & Arabian Sea depression monitoring, wave height & fisherfolk safety alerts.',
    icon: 'tsunami',
    badge: 'Maritime Watch',
    badgeColor: 'bg-cyan-50 text-cyan-800 border-cyan-200',
    accentColor: 'text-cyan-600',
    route: 'safety' as const
  },
  {
    id: 'safety',
    title: 'Disaster & Civil Safety',
    description: 'Flood evasion protocols, shelter location maps, emergency supply kits, and district helplines.',
    icon: 'health_and_safety',
    badge: 'Civil Defense',
    badgeColor: 'bg-rose-50 text-rose-800 border-rose-200',
    accentColor: 'text-rose-600',
    route: 'safety' as const
  }
];
