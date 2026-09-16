import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

const app = express();
const PORT = 3000;

// Lazy Gemini client initialization
let geminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!process.env.GEMINI_API_KEY) return null;
  if (!geminiClient) {
    geminiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
    });
  }
  return geminiClient;
}

// Simple in-memory caches to avoid hammering upstream APIs
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const weatherCache = new Map<string, CacheEntry<any>>();
const geocodeCache = new Map<string, CacheEntry<any>>();
const geocodeSearchCache = new Map<string, CacheEntry<any>>();

const WEATHER_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const GEOCODE_CACHE_TTL_MS = 60 * 60 * 1000; // 60 minutes

app.use(express.json());

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

interface GeocodeItem {
  id?: number;
  name: string;
  state: string;
  country: string;
  countryCode?: string;
  latitude: number;
  longitude: number;
  displayName: string;
}

interface OpenMeteoResult {
  weather: any;
  airQuality: any;
  source: string;
  retrievedAt: string;
}

interface ResolvedLocation {
  name: string;
  state: string;
  country: string;
  latitude: number;
  longitude: number;
  displayName: string;
}

// Known cities dictionary for fast and exact disambiguation
const KNOWN_INDIAN_CITIES: Record<string, { lat: number; lon: number; name: string; state: string; country: string }> = {
  bengaluru: { lat: 12.9716, lon: 77.5946, name: 'Bengaluru', state: 'Karnataka', country: 'India' },
  bangalore: { lat: 12.9716, lon: 77.5946, name: 'Bengaluru', state: 'Karnataka', country: 'India' },
  'ಬೆಂಗಳೂರು': { lat: 12.9716, lon: 77.5946, name: 'Bengaluru', state: 'Karnataka', country: 'India' },
  mumbai: { lat: 19.0760, lon: 72.8777, name: 'Mumbai', state: 'Maharashtra', country: 'India' },
  bombay: { lat: 19.0760, lon: 72.8777, name: 'Mumbai', state: 'Maharashtra', country: 'India' },
  'मुंबई': { lat: 19.0760, lon: 72.8777, name: 'Mumbai', state: 'Maharashtra', country: 'India' },
  'ಮುಂಬೈ': { lat: 19.0760, lon: 72.8777, name: 'Mumbai', state: 'Maharashtra', country: 'India' },
  delhi: { lat: 28.6519, lon: 77.2315, name: 'Delhi', state: 'Delhi', country: 'India' },
  'new delhi': { lat: 28.6139, lon: 77.2090, name: 'New Delhi', state: 'Delhi', country: 'India' },
  'दिल्ली': { lat: 28.6519, lon: 77.2315, name: 'Delhi', state: 'Delhi', country: 'India' },
  'ದೆಹಲಿ': { lat: 28.6519, lon: 77.2315, name: 'Delhi', state: 'Delhi', country: 'India' },
  chennai: { lat: 13.0827, lon: 80.2707, name: 'Chennai', state: 'Tamil Nadu', country: 'India' },
  madras: { lat: 13.0827, lon: 80.2707, name: 'Chennai', state: 'Tamil Nadu', country: 'India' },
  'चेन्नई': { lat: 13.0827, lon: 80.2707, name: 'Chennai', state: 'Tamil Nadu', country: 'India' },
  kolkata: { lat: 22.5726, lon: 88.3639, name: 'Kolkata', state: 'West Bengal', country: 'India' },
  calcutta: { lat: 22.5726, lon: 88.3639, name: 'Kolkata', state: 'West Bengal', country: 'India' },
  'कोलकाता': { lat: 22.5726, lon: 88.3639, name: 'Kolkata', state: 'West Bengal', country: 'India' },
  hyderabad: { lat: 17.3850, lon: 78.4867, name: 'Hyderabad', state: 'Telangana', country: 'India' },
  'हैदराबाद': { lat: 17.3850, lon: 78.4867, name: 'Hyderabad', state: 'Telangana', country: 'India' },
  pune: { lat: 18.5204, lon: 73.8567, name: 'Pune', state: 'Maharashtra', country: 'India' },
  'पुणे': { lat: 18.5204, lon: 73.8567, name: 'Pune', state: 'Maharashtra', country: 'India' },
  ahmedabad: { lat: 23.0225, lon: 72.5714, name: 'Ahmedabad', state: 'Gujarat', country: 'India' },
  jaipur: { lat: 26.9124, lon: 75.7873, name: 'Jaipur', state: 'Rajasthan', country: 'India' },
  lucknow: { lat: 26.8467, lon: 80.9462, name: 'Lucknow', state: 'Uttar Pradesh', country: 'India' },
  kanpur: { lat: 26.4499, lon: 80.3319, name: 'Kanpur', state: 'Uttar Pradesh', country: 'India' },
  nagpur: { lat: 21.1458, lon: 79.0882, name: 'Nagpur', state: 'Maharashtra', country: 'India' },
  indore: { lat: 22.7196, lon: 75.8577, name: 'Indore', state: 'Madhya Pradesh', country: 'India' },
  bhopal: { lat: 23.2599, lon: 77.4126, name: 'Bhopal', state: 'Madhya Pradesh', country: 'India' },
  visakhapatnam: { lat: 17.6868, lon: 83.2185, name: 'Visakhapatnam', state: 'Andhra Pradesh', country: 'India' },
  vizag: { lat: 17.6868, lon: 83.2185, name: 'Visakhapatnam', state: 'Andhra Pradesh', country: 'India' },
  patna: { lat: 25.6127, lon: 85.1444, name: 'Patna', state: 'Bihar', country: 'India' },
  vadodara: { lat: 22.3072, lon: 73.1812, name: 'Vadodara', state: 'Gujarat', country: 'India' },
  surat: { lat: 21.1702, lon: 72.8311, name: 'Surat', state: 'Gujarat', country: 'India' },
  chandigarh: { lat: 30.7333, lon: 76.7794, name: 'Chandigarh', state: 'Punjab', country: 'India' },
  shimla: { lat: 31.1048, lon: 77.1734, name: 'Shimla', state: 'Himachal Pradesh', country: 'India' },
  dehradun: { lat: 30.3165, lon: 78.0322, name: 'Dehradun', state: 'Uttarakhand', country: 'India' },
  kochi: { lat: 9.9312, lon: 76.2673, name: 'Kochi', state: 'Kerala', country: 'India' },
  cochin: { lat: 9.9312, lon: 76.2673, name: 'Kochi', state: 'Kerala', country: 'India' },
  thiruvananthapuram: { lat: 8.5241, lon: 76.9366, name: 'Thiruvananthapuram', state: 'Kerala', country: 'India' },
  trivandrum: { lat: 8.5241, lon: 76.9366, name: 'Thiruvananthapuram', state: 'Kerala', country: 'India' },
  guwahati: { lat: 26.1445, lon: 91.7362, name: 'Guwahati', state: 'Assam', country: 'India' },
  sakleshpur: { lat: 12.8953, lon: 75.7877, name: 'Sakleshpur', state: 'Karnataka', country: 'India' },
  mysuru: { lat: 12.2958, lon: 76.6394, name: 'Mysuru', state: 'Karnataka', country: 'India' },
  mysore: { lat: 12.2958, lon: 76.6394, name: 'Mysuru', state: 'Karnataka', country: 'India' },
  mangaluru: { lat: 12.9141, lon: 74.8560, name: 'Mangaluru', state: 'Karnataka', country: 'India' },
  mangalore: { lat: 12.9141, lon: 74.8560, name: 'Mangaluru', state: 'Karnataka', country: 'India' },
  goa: { lat: 15.2993, lon: 74.1240, name: 'Panaji', state: 'Goa', country: 'India' },
  panaji: { lat: 15.4909, lon: 73.8278, name: 'Panaji', state: 'Goa', country: 'India' },
  srinagar: { lat: 34.0837, lon: 74.7973, name: 'Srinagar', state: 'Jammu and Kashmir', country: 'India' },
  varanasi: { lat: 25.3176, lon: 82.9739, name: 'Varanasi', state: 'Uttar Pradesh', country: 'India' },
  amritsar: { lat: 31.6340, lon: 74.8723, name: 'Amritsar', state: 'Punjab', country: 'India' },
  ranchi: { lat: 23.3441, lon: 85.3096, name: 'Ranchi', state: 'Jharkhand', country: 'India' },
  coimbatore: { lat: 11.0168, lon: 76.9558, name: 'Coimbatore', state: 'Tamil Nadu', country: 'India' },
  madurai: { lat: 9.9252, lon: 78.1198, name: 'Madurai', state: 'Tamil Nadu', country: 'India' },
  noida: { lat: 28.5355, lon: 77.3910, name: 'Noida', state: 'Uttar Pradesh', country: 'India' },
  gurugram: { lat: 28.4595, lon: 77.0266, name: 'Gurugram', state: 'Haryana', country: 'India' },
  gurgaon: { lat: 28.4595, lon: 77.0266, name: 'Gurugram', state: 'Haryana', country: 'India' }
};

function getWmoCondition(code: number): { condition: string; isRain: boolean; isStorm: boolean } {
  switch (code) {
    case 0: return { condition: 'Clear Sky', isRain: false, isStorm: false };
    case 1: return { condition: 'Mainly Clear', isRain: false, isStorm: false };
    case 2: return { condition: 'Partly Cloudy', isRain: false, isStorm: false };
    case 3: return { condition: 'Overcast', isRain: false, isStorm: false };
    case 45:
    case 48: return { condition: 'Fog & Mist', isRain: false, isStorm: false };
    case 51:
    case 53:
    case 55: return { condition: 'Drizzle', isRain: true, isStorm: false };
    case 56:
    case 57: return { condition: 'Freezing Drizzle', isRain: true, isStorm: false };
    case 61: return { condition: 'Slight Rain', isRain: true, isStorm: false };
    case 63: return { condition: 'Moderate Rain', isRain: true, isStorm: false };
    case 65: return { condition: 'Heavy Rain', isRain: true, isStorm: false };
    case 71:
    case 73:
    case 75: return { condition: 'Snowfall', isRain: false, isStorm: false };
    case 80:
    case 81: return { condition: 'Rain Showers', isRain: true, isStorm: false };
    case 82: return { condition: 'Violent Rain Showers', isRain: true, isStorm: false };
    case 95:
    case 96:
    case 99: return { condition: 'Thunderstorm', isRain: true, isStorm: true };
    default: return { condition: 'Fair', isRain: false, isStorm: false };
  }
}

/**
 * Geocodes a place name via Open-Meteo geocoding API
 */
async function geocodeLocation(query: string): Promise<GeocodeItem[]> {
  const clean = query.trim().toLowerCase();
  if (!clean) return [];

  const now = Date.now();
  const cached = geocodeSearchCache.get(clean);
  if (cached && now - cached.timestamp < GEOCODE_CACHE_TTL_MS) {
    return cached.data;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4500);

  try {
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(clean)}&count=5&language=en&format=json`;
    const response = await fetch(geoUrl, {
      headers: { 'User-Agent': 'WeatherGPT-Applet/1.0 (weathergpt@local)' },
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`Open-Meteo geocoding responded with HTTP ${response.status}`);
    }

    const data = await response.json();
    const rawResults = data.results || [];

    const cleanResults: GeocodeItem[] = rawResults.map((item: any) => {
      const name = item.name || '';
      const state = item.admin1 || item.admin2 || '';
      const country = item.country || '';
      const parts: string[] = [name];
      if (state && state !== name) parts.push(state);
      if (country) parts.push(country);

      return {
        id: item.id,
        name,
        state,
        country,
        countryCode: item.country_code,
        latitude: item.latitude,
        longitude: item.longitude,
        displayName: parts.join(', ')
      };
    });

    geocodeSearchCache.set(clean, { data: cleanResults, timestamp: now });
    return cleanResults;
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

/**
 * Fetches real weather and air quality concurrently from Open-Meteo
 */
async function fetchOpenMeteoWeather(latitude: number, longitude: number): Promise<OpenMeteoResult> {
  const cacheKey = `${latitude.toFixed(3)},${longitude.toFixed(3)}`;
  const now = Date.now();

  const cached = weatherCache.get(cacheKey);
  if (cached && now - cached.timestamp < WEATHER_CACHE_TTL_MS) {
    return cached.data;
  }

  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,rain,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,surface_pressure,visibility,uv_index,is_day&hourly=temperature_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_direction_10m,relative_humidity_2m,visibility,dew_point_2m,is_day&daily=temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_sum,precipitation_probability_max,weather_code&timezone=auto&forecast_days=7`;
  const airQualityUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${latitude}&longitude=${longitude}&current=pm10,pm2_5,european_aqi,us_aqi`;

  const [weatherRes, airQualityRes] = await Promise.allSettled([
    fetch(weatherUrl, { headers: { 'User-Agent': 'WeatherGPT-App/1.0' } }),
    fetch(airQualityUrl, { headers: { 'User-Agent': 'WeatherGPT-App/1.0' } })
  ]);

  if (weatherRes.status !== 'fulfilled' || !weatherRes.value.ok) {
    const errorMsg = weatherRes.status === 'fulfilled'
      ? `Open-Meteo returned status ${weatherRes.value.status}`
      : (weatherRes.reason?.message || 'Network error connecting to Open-Meteo');
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

  const payload: OpenMeteoResult = {
    weather: weatherData,
    airQuality: airQualityData,
    source: 'Open-Meteo',
    retrievedAt: new Date().toISOString()
  };

  weatherCache.set(cacheKey, { data: payload, timestamp: now });
  return payload;
}

const QUERY_STOP_WORDS = new Set([
  'the', 'a', 'an', 'it', 'is', 'be', 'will', 'was', 'are', 'were', 'been',
  'this', 'that', 'there', 'here', 'my', 'our', 'your', 'weather', 'climate',
  'forecast', 'temperature', 'temp', 'rain', 'raining', 'sunny', 'cloudy',
  'humid', 'humidity', 'wind', 'windy', 'storm', 'monsoon', 'today', 'tomorrow',
  'tonight', 'yesterday', 'morning', 'afternoon', 'evening', 'night', 'now',
  'outside', 'travel', 'drive', 'safe', 'safety', 'hot', 'cold', 'warm', 'feel',
  'feels', 'like', 'going', 'can', 'should', 'would', 'could', 'what', 'how',
  'when', 'why', 'where', 'who', 'please', 'tell', 'me', 'us', 'about', 'condition',
  'conditions', 'air', 'quality', 'aqi', 'umbrella', 'clothes', 'dry'
]);

/**
 * Extracts a candidate city name mentioned in a natural language query
 */
function extractLocationCandidate(query: string): string | null {
  const lower = query.toLowerCase().trim();

  // 1. Direct dictionary match for prominent Indian cities
  for (const [key, value] of Object.entries(KNOWN_INDIAN_CITIES)) {
    if (/[\u0900-\u097F\u0C80-\u0CFF]/.test(key)) {
      if (lower.includes(key.toLowerCase())) {
        return value.name;
      }
    } else {
      const regex = new RegExp(`\\b${key}\\b`, 'i');
      if (regex.test(lower)) {
        return value.name;
      }
    }
  }

  // 2. Preposition patterns: e.g. "weather in Mumbai", "rain in Delhi today", "temperature at Sakleshpur"
  const patterns = [
    /\b(?:in|at|around|near)\s+([a-zA-Z\s.-]+?)(?:\s+(?:today|tomorrow|tonight|yesterday|this\s+morning|this\s+afternoon|this\s+evening|this\s+week|next\s+week|now|right\s+now|outside|currently|please|\?|$))/i,
    /\b(?:weather|forecast|rain|temperature|temp|climate|conditions|monsoon)\s+(?:in|at|around|for)\s+([a-zA-Z\s.-]+)/i,
    /\b(?:how\s+is|what\s+is|what's|how's)\s+(?:the\s+)?(?:weather|temp|temperature|forecast|climate)\s+(?:in|at|around|for)\s+([a-zA-Z\s.-]+)/i,
    /\b([A-Z][a-zA-Z]+)(?:'s)?\s+(?:weather|forecast|temperature|temp)\b/,
    /\b(?:will\s+it\s+rain|is\s+it\s+raining|is\s+it\s+going\s+to\s+rain)\s+(?:in|at|around)\s+([a-zA-Z\s.-]+)/i,
    /\b(?:can\s+i\s+travel|travel\s+safety)\s+(?:in|around|to)\s+([a-zA-Z\s.-]+)/i
  ];

  for (const pattern of patterns) {
    const match = query.match(pattern);
    if (match && match[1]) {
      let cand = match[1].trim();
      cand = cand.replace(/\b(today|tomorrow|tonight|now|right now|this afternoon|this morning|this evening|this week|next week|please|outside|\?)\b/gi, '').trim();
      const words = cand.toLowerCase().split(/\s+/).filter(Boolean);
      const isAllStopWords = words.length === 0 || words.every(w => QUERY_STOP_WORDS.has(w));
      if (!isAllStopWords && cand.length >= 2) {
        return cand;
      }
    }
  }

  return null;
}

// POST /api/ai/weather-chat - Real Open-Meteo Retrieval + Gemini AI Reasoning
app.post('/api/ai/weather-chat', async (req, res) => {
  try {
    const { query, locationName = 'Bengaluru', latitude: reqLat, longitude: reqLon } = req.body;
    if (!query || typeof query !== 'string' || !query.trim()) {
      return res.status(400).json({ error: 'Query string is required' });
    }

    const trimmedQuery = query.trim();

    // 1. Determine location dynamically from query or fallback to active location
    const candidateLocation = extractLocationCandidate(trimmedQuery);
    let resolvedLocation: ResolvedLocation | null = null;

    if (candidateLocation) {
      const known = KNOWN_INDIAN_CITIES[candidateLocation.toLowerCase()];
      if (known) {
        resolvedLocation = {
          name: known.name,
          state: known.state,
          country: known.country,
          latitude: known.lat,
          longitude: known.lon,
          displayName: `${known.name}, ${known.state}, ${known.country}`
        };
      } else {
        try {
          const searchResults = await geocodeLocation(candidateLocation);
          if (searchResults && searchResults.length > 0) {
            // Prioritize Indian results if available, else first match
            const best = searchResults.find(r => r.countryCode === 'IN') || searchResults[0];
            resolvedLocation = {
              name: best.name,
              state: best.state || '',
              country: best.country || '',
              latitude: best.latitude,
              longitude: best.longitude,
              displayName: best.displayName
            };
          } else {
            // Location could not be identified - ask user to clarify (Requirement 10)
            return res.json({
              query: trimmedQuery,
              summary: `I couldn't identify the meteorological location for "${candidateLocation}". Please clarify which city or district you would like weather information for (e.g., "What is the weather in Mumbai?").`,
              riskLevel: 'Low',
              timing: 'Awaiting location',
              actionItems: [
                'Specify a recognized Indian or global city name.',
                'Check the spelling of the location or include the state name.'
              ],
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              sourceDisclaimer: 'Open-Meteo Geocoding',
              locationUsed: candidateLocation,
              needsClarification: true
            });
          }
        } catch (geoErr: any) {
          console.warn('[Geocoding Lookup Error in AI Chat]:', geoErr?.message || geoErr);
          return res.status(502).json({
            isError: true,
            error: 'Location resolution service temporarily unavailable',
            summary: `Unable to geocode "${candidateLocation}" at this time. Please try again in a few moments.`,
            riskLevel: 'Low',
            timing: 'Unavailable',
            actionItems: ['Check network connectivity and retry your request.'],
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            sourceDisclaimer: 'Open-Meteo Geocoding Unavailable'
          });
        }
      }
    } else {
      // No explicit city mentioned in query -> use active location from request
      let lat = typeof reqLat === 'number' ? reqLat : undefined;
      let lon = typeof reqLon === 'number' ? reqLon : undefined;
      let name = typeof locationName === 'string' && locationName ? locationName : 'Bengaluru';

      const known = KNOWN_INDIAN_CITIES[name.toLowerCase()];
      if (known) {
        lat = lat ?? known.lat;
        lon = lon ?? known.lon;
        name = known.name;
        resolvedLocation = {
          name,
          state: known.state,
          country: known.country,
          latitude: lat,
          longitude: lon,
          displayName: `${name}, ${known.state}, ${known.country}`
        };
      } else if (lat !== undefined && lon !== undefined) {
        resolvedLocation = {
          name,
          state: '',
          country: 'India',
          latitude: lat,
          longitude: lon,
          displayName: name
        };
      } else {
        // Attempt geocoding fallback for locationName
        try {
          const results = await geocodeLocation(name);
          if (results && results.length > 0) {
            const best = results.find(r => r.countryCode === 'IN') || results[0];
            resolvedLocation = {
              name: best.name,
              state: best.state || '',
              country: best.country || '',
              latitude: best.latitude,
              longitude: best.longitude,
              displayName: best.displayName
            };
          }
        } catch (_) {}
      }

      // Default fallback if still unresolved
      if (!resolvedLocation) {
        resolvedLocation = {
          name: 'Bengaluru',
          state: 'Karnataka',
          country: 'India',
          latitude: 12.9716,
          longitude: 77.5946,
          displayName: 'Bengaluru, Karnataka, India'
        };
      }
    }

    // 2. Retrieve real weather data from Open-Meteo
    let meteoData: OpenMeteoResult;
    try {
      meteoData = await fetchOpenMeteoWeather(resolvedLocation.latitude, resolvedLocation.longitude);
    } catch (fetchErr: any) {
      // Requirement 11: If Open-Meteo fails, return clear error instead of fabricating weather information
      console.error('[Open-Meteo Weather Fetch Failed]:', fetchErr?.message || fetchErr);
      return res.status(502).json({
        isError: true,
        error: 'Failed to retrieve real-time weather from Open-Meteo',
        summary: `Live meteorological telemetry for ${resolvedLocation.name} is currently unavailable from Open-Meteo. Weather conditions were not fabricated.`,
        riskLevel: 'Moderate',
        timing: 'Service Unavailable',
        actionItems: [
          'Verify connection to Open-Meteo API.',
          'Please retry your request in a few moments.'
        ],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        sourceDisclaimer: 'Open-Meteo Service Unavailable'
      });
    }

    // 3. Extract factual meteorological observations & forecast
    const current = meteoData.weather.current || {};
    const daily = meteoData.weather.daily || {};
    const hourly = meteoData.weather.hourly || {};
    const airQuality = meteoData.airQuality?.current || {};

    const currentTemp = Math.round(current.temperature_2m ?? 25);
    const apparentTemp = Math.round(current.apparent_temperature ?? currentTemp);
    const humidity = current.relative_humidity_2m ?? 60;
    const currentWmo = current.weather_code ?? 0;
    const wmoInfo = getWmoCondition(currentWmo);
    const conditionName = wmoInfo.condition;
    const precipMm = current.precipitation ?? 0;
    const rainMm = current.rain ?? 0;
    const windSpeed = Math.round(current.wind_speed_10m ?? 10);
    const windGusts = Math.round(current.wind_gusts_10m ?? windSpeed);
    const uvIndex = current.uv_index ?? 3;
    const visibilityKm = current.visibility ? Math.round(current.visibility / 1000) : 10;
    const surfacePressure = current.surface_pressure ?? 1012;

    // Today's daily metrics (index 0)
    const todayMaxTemp = daily.temperature_2m_max?.[0] ? Math.round(daily.temperature_2m_max[0]) : currentTemp + 3;
    const todayMinTemp = daily.temperature_2m_min?.[0] ? Math.round(daily.temperature_2m_min[0]) : currentTemp - 5;
    const todayRainProb = daily.precipitation_probability_max?.[0] ?? 20;
    const todayPrecipSum = daily.precipitation_sum?.[0] ?? 0;
    const todayWmo = daily.weather_code?.[0] ?? currentWmo;
    const todayCondition = getWmoCondition(todayWmo).condition;

    // Tomorrow's daily metrics (index 1)
    const tomorrowMaxTemp = daily.temperature_2m_max?.[1] ? Math.round(daily.temperature_2m_max[1]) : todayMaxTemp;
    const tomorrowMinTemp = daily.temperature_2m_min?.[1] ? Math.round(daily.temperature_2m_min[1]) : todayMinTemp;
    const tomorrowRainProb = daily.precipitation_probability_max?.[1] ?? 25;
    const tomorrowPrecipSum = daily.precipitation_sum?.[1] ?? 0;
    const tomorrowWmo = daily.weather_code?.[1] ?? todayWmo;
    const tomorrowCondition = getWmoCondition(tomorrowWmo).condition;

    // Air Quality
    const aqi = airQuality.us_aqi ?? null;
    const pm25 = airQuality.pm2_5 ? Math.round(airQuality.pm2_5) : null;
    const pm10 = airQuality.pm10 ? Math.round(airQuality.pm10) : null;

    // Next 12 hours hourly highlights
    const hourlyTimes: string[] = hourly.time || [];
    const hourlyTemps: number[] = hourly.temperature_2m || [];
    const hourlyRainProbs: number[] = hourly.precipitation_probability || [];
    const hourlyWmo: number[] = hourly.weather_code || [];

    const nowIso = new Date().toISOString();
    let next12HoursFormatted = '';
    const startIndex = hourlyTimes.findIndex(t => t >= nowIso.slice(0, 13));
    const start = startIndex >= 0 ? startIndex : 0;
    const hourlySlice = hourlyTimes.slice(start, start + 12);

    next12HoursFormatted = hourlySlice.map((t, idx) => {
      const actualIdx = start + idx;
      const hourStr = t.split('T')[1] || t;
      const temp = hourlyTemps[actualIdx] ?? currentTemp;
      const rain = hourlyRainProbs[actualIdx] ?? 0;
      const cond = getWmoCondition(hourlyWmo[actualIdx] ?? 0).condition;
      return `${hourStr}: ${temp}°C, ${cond}, rain prob ${rain}%`;
    }).join('; ');

    // 4. Gemini Conversational Reasoning Layer
    const ai = getGeminiClient();
    if (ai) {
      const systemInstruction = `You are WeatherGPT, a conversational meteorological assistant for India.
You answer user weather inquiries strictly grounded in real meteorological observations and forecasts retrieved from Open-Meteo.

CRITICAL DIRECTIVES:
1. NEVER invent or fabricate current weather conditions or forecasts. Strictly use the retrieved Open-Meteo telemetry provided below.
2. Clearly distinguish retrieved facts (recorded temperatures, measured humidity, forecast rain probability) from conversational interpretation and commuter advice.
3. Do NOT claim the data comes from IMD, BBMP, Doppler radar, INSAT, or 40-year datasets. The data is retrieved live from Open-Meteo.
4. If the user asks about tomorrow, focus on Tomorrow's retrieved forecast data.
5. If the user asks about rain, focus on precipitation probability, precipitation sum, and hourly rain outlook.
6. If the user asks about heat or how hot it will feel, discuss temperature vs apparent temperature (feels like) and humidity.
7. If the user asks about travel safety, evaluate rain intensity, wind gusts, visibility, and AQI based on the retrieved data.
8. Maintain a helpful, conversational, professional tone in 2-3 clear sentences.

You must respond ONLY with a valid JSON object matching this schema:
{
  "summary": "2-3 conversational sentences directly answering the question with exact temperatures, conditions, and insights grounded in the Open-Meteo data.",
  "riskLevel": "Low" | "Moderate" | "High",
  "timing": "Specific relevant time window (e.g., 'Today afternoon & evening', 'Tomorrow all day', 'Next 4-6 hours', 'Current window')",
  "actionItems": [
    "Practical actionable precaution or advice item 1",
    "Practical actionable precaution or advice item 2"
  ]
}`;

      const dataContext = `TARGET LOCATION:
${resolvedLocation.displayName} (Lat: ${resolvedLocation.latitude.toFixed(2)}, Lon: ${resolvedLocation.longitude.toFixed(2)})

REAL OPEN-METEO RETRIEVED TELEMETRY:
Current Conditions:
- Temperature: ${currentTemp}°C (Feels like: ${apparentTemp}°C)
- Condition: ${conditionName} (WMO Code: ${currentWmo})
- Relative Humidity: ${humidity}%
- Current Rain: ${rainMm} mm (Total Precip: ${precipMm} mm)
- Wind Speed: ${windSpeed} km/h (Gusts: ${windGusts} km/h)
- UV Index: ${uvIndex}
- Surface Pressure: ${surfacePressure} hPa
- Visibility: ${visibilityKm} km
- Air Quality: US AQI ${aqi ?? 'N/A'}, PM2.5: ${pm25 ?? 'N/A'} µg/m³, PM10: ${pm10 ?? 'N/A'} µg/m³

Today's Forecast:
- High: ${todayMaxTemp}°C | Low: ${todayMinTemp}°C
- Condition: ${todayCondition}
- Peak Rain Probability: ${todayRainProb}%
- Cumulative Precipitation: ${todayPrecipSum} mm

Tomorrow's Forecast:
- High: ${tomorrowMaxTemp}°C | Low: ${tomorrowMinTemp}°C
- Condition: ${tomorrowCondition}
- Peak Rain Probability: ${tomorrowRainProb}%
- Cumulative Precipitation: ${tomorrowPrecipSum} mm

Hourly Progression (Next 12 Hours):
${next12HoursFormatted || 'Hourly trend consistent with daily forecast.'}`;

      try {
        let aiResponse = null;
        for (const model of ['gemini-3.6-flash', 'gemini-3.8-flash']) {
          try {
            aiResponse = await ai.models.generateContent({
              model,
              contents: [
                {
                  role: 'user',
                  parts: [{ text: `${systemInstruction}\n\n${dataContext}\n\nUSER QUESTION: "${trimmedQuery}"` }]
                }
              ],
              config: {
                responseMimeType: 'application/json'
              }
            });
            if (aiResponse?.text) break;
          } catch (modelErr: any) {
            console.warn(`[Gemini AI ${model} Attempt Warning]:`, modelErr?.message || modelErr);
          }
        }

        const text = aiResponse?.text;
        if (text) {
          const parsed = JSON.parse(text);
          return res.json({
            query: trimmedQuery,
            summary: parsed.summary || `Current temperature in ${resolvedLocation.name} is ${currentTemp}°C with ${conditionName.toLowerCase()}.`,
            riskLevel: ['Low', 'Moderate', 'High'].includes(parsed.riskLevel) ? parsed.riskLevel : (todayRainProb > 60 || wmoInfo.isStorm ? 'High' : (todayRainProb > 30 ? 'Moderate' : 'Low')),
            timing: parsed.timing || 'Current Window',
            actionItems: Array.isArray(parsed.actionItems) && parsed.actionItems.length > 0
              ? parsed.actionItems
              : ['Check updated forecasts before embarking on long commutes.'],
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            sourceDisclaimer: 'Live Open-Meteo telemetry • Grounded by Gemini AI',
            locationUsed: resolvedLocation.displayName,
            isLive: true
          });
        }
      } catch (geminiError: any) {
        console.warn('[Gemini AI Generation Warning]:', geminiError?.message || geminiError);
      }
    }

    // 5. Deterministic Factual Synthesis from Real Open-Meteo Data (if Gemini unavailable or fails)
    const isTomorrowQuestion = /\btomorrow\b/i.test(trimmedQuery);
    const isRainQuestion = /\b(rain|raining|showers|umbrella|precipitation)\b/i.test(trimmedQuery);
    const isHeatQuestion = /\b(hot|heat|temperature|temp|feels like|warm|cool)\b/i.test(trimmedQuery);
    const isSafetyQuestion = /\b(safe|travel|outside|commute|cyclone|storm)\b/i.test(trimmedQuery);

    let summary = '';
    let riskLevel: 'Low' | 'Moderate' | 'High' = 'Low';
    let timing = 'Current conditions';
    const actionItems: string[] = [];

    if (isTomorrowQuestion) {
      summary = `Tomorrow in ${resolvedLocation.name}, expect a daytime high of ${tomorrowMaxTemp}°C and a low of ${tomorrowMinTemp}°C with ${tomorrowCondition.toLowerCase()}. Rain probability reaches a peak of ${tomorrowRainProb}% with approximately ${tomorrowPrecipSum} mm precipitation.`;
      riskLevel = tomorrowRainProb >= 65 ? 'High' : (tomorrowRainProb >= 35 ? 'Moderate' : 'Low');
      timing = 'Tomorrow (Full Day)';
      if (tomorrowRainProb >= 40) {
        actionItems.push(`Carry an umbrella or rainwear; ${tomorrowRainProb}% precipitation odds expected.`);
      }
      actionItems.push(`Dress comfortably for temperatures between ${tomorrowMinTemp}°C and ${tomorrowMaxTemp}°C.`);
    } else if (isRainQuestion) {
      if (todayRainProb >= 40 || precipMm > 0 || wmoInfo.isRain) {
        summary = `In ${resolvedLocation.name}, current condition is ${conditionName.toLowerCase()} with ${precipMm > 0 ? `${precipMm} mm recorded rainfall` : 'rain likely later today'}. Maximum rain probability today is ${todayRainProb}% with up to ${todayPrecipSum} mm total precipitation expected.`;
        riskLevel = todayRainProb >= 65 ? 'High' : 'Moderate';
        timing = 'Today afternoon & evening';
        actionItems.push('Keep rain gear ready for intermittent showers.');
        actionItems.push('Allow extra travel time for wet road conditions.');
      } else {
        summary = `In ${resolvedLocation.name}, rain probability remains low today at ${todayRainProb}% with mostly ${todayCondition.toLowerCase()} skies. No significant precipitation is anticipated.`;
        riskLevel = 'Low';
        timing = 'Today';
        actionItems.push('Conditions are favorable for outdoor commuting.');
      }
    } else if (isHeatQuestion) {
      summary = `Currently in ${resolvedLocation.name}, the temperature is ${currentTemp}°C, but relative humidity of ${humidity}% makes it feel like ${apparentTemp}°C. Today's high is forecast to reach ${todayMaxTemp}°C under ${todayCondition.toLowerCase()} skies.`;
      riskLevel = apparentTemp >= 38 ? 'High' : (apparentTemp >= 32 ? 'Moderate' : 'Low');
      timing = 'Afternoon peak hours';
      if (apparentTemp >= 32) {
        actionItems.push('Stay hydrated and minimize prolonged midday sun exposure.');
      }
      if (uvIndex >= 6) {
        actionItems.push(`UV index is elevated at ${uvIndex}; consider sun protection during peak daylight.`);
      }
    } else if (isSafetyQuestion) {
      const isDangerous = wmoInfo.isStorm || windGusts >= 45 || visibilityKm < 3;
      riskLevel = isDangerous ? 'High' : (todayRainProb >= 50 || windSpeed >= 25 ? 'Moderate' : 'Low');
      summary = isDangerous
        ? `Travel advisory for ${resolvedLocation.name}: ${conditionName} with wind gusts reaching ${windGusts} km/h and visibility of ${visibilityKm} km. Exercise elevated caution if commuting.`
        : `Conditions in ${resolvedLocation.name} are generally manageable for travel with ${conditionName.toLowerCase()}, wind speeds of ${windSpeed} km/h, and visibility of ${visibilityKm} km.`;
      timing = 'Next 4-6 hours';
      actionItems.push(`Check route conditions before driving; wind gusts currently at ${windGusts} km/h.`);
      if (aqi && aqi > 100) {
        actionItems.push(`Air quality index is ${aqi} (PM2.5: ${pm25} µg/m³); sensitive groups should take precautions.`);
      }
    } else {
      summary = `In ${resolvedLocation.name}, it is currently ${currentTemp}°C (feels like ${apparentTemp}°C) with ${conditionName.toLowerCase()}. Humidity is ${humidity}%, winds are blowing at ${windSpeed} km/h, and today's high will be ${todayMaxTemp}°C.`;
      riskLevel = todayRainProb > 60 || wmoInfo.isStorm ? 'High' : (todayRainProb > 30 ? 'Moderate' : 'Low');
      timing = 'Current conditions';
      if (todayRainProb >= 35) {
        actionItems.push(`Keep an umbrella handy; rain probability is ${todayRainProb}% today.`);
      }
      actionItems.push('Consult live hourly forecast for sudden shifts.');
    }

    return res.json({
      query: trimmedQuery,
      summary,
      riskLevel,
      timing,
      actionItems: actionItems.length > 0 ? actionItems : ['Check local weather updates periodically.'],
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      sourceDisclaimer: 'Live Open-Meteo telemetry',
      locationUsed: resolvedLocation.displayName,
      isLive: true
    });
  } catch (error: any) {
    console.error('[Weather Chat Unexpected Error]:', error);
    return res.status(500).json({
      isError: true,
      error: 'Internal server error while processing weather chat',
      message: error?.message || 'Unknown error'
    });
  }
});

// GET /api/weather?latitude=12.9716&longitude=77.5946
app.get('/api/weather', async (req, res) => {
  try {
    const latStr = req.query.latitude as string;
    const lonStr = req.query.longitude as string;

    if (!latStr || !lonStr) {
      return res.status(400).json({
        error: 'Missing required query parameters: latitude and longitude'
      });
    }

    const latitude = parseFloat(latStr);
    const longitude = parseFloat(lonStr);

    if (isNaN(latitude) || isNaN(longitude)) {
      return res.status(400).json({
        error: 'Invalid latitude or longitude coordinates'
      });
    }

    const payload = await fetchOpenMeteoWeather(latitude, longitude);
    return res.json(payload);
  } catch (error: any) {
    console.error('[Weather API Error]:', error);
    return res.status(502).json({
      error: 'Failed to fetch meteorological data from Open-Meteo',
      details: error?.message || 'Upstream service error'
    });
  }
});

// GET /api/geocode/search?q=Sakleshpur
app.get('/api/geocode/search', async (req, res) => {
  try {
    const rawQuery = (req.query.q as string) || '';
    const query = rawQuery.trim();

    if (!query) {
      return res.json([]);
    }

    const results = await geocodeLocation(query);
    return res.json(results);
  } catch (error: any) {
    console.error('[Geocoding Search Error]:', error);
    return res.status(502).json({
      error: 'Geocoding service unavailable',
      message: error?.message || 'Failed to fetch coordinates'
    });
  }
});

// GET /api/geocode/reverse?latitude=12.9716&longitude=77.5946
app.get('/api/geocode/reverse', async (req, res) => {
  try {
    const latStr = req.query.latitude as string;
    const lonStr = req.query.longitude as string;

    if (!latStr || !lonStr) {
      return res.status(400).json({
        error: 'Missing required query parameters: latitude and longitude'
      });
    }

    const latitude = parseFloat(latStr);
    const longitude = parseFloat(lonStr);

    if (isNaN(latitude) || isNaN(longitude)) {
      return res.status(400).json({
        error: 'Invalid coordinates'
      });
    }

    const cacheKey = `${latitude.toFixed(3)},${longitude.toFixed(3)}`;
    const now = Date.now();

    const cached = geocodeCache.get(cacheKey);
    if (cached && now - cached.timestamp < GEOCODE_CACHE_TTL_MS) {
      return res.json(cached.data);
    }

    // Call Nominatim with User-Agent header and 4s timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    let locationInfo = {
      name: 'Current Location',
      state: '',
      country: '',
      displayName: 'Current Location'
    };

    try {
      const geoRes = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=12&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'WeatherGPT-Applet/1.0 (weathergpt@local)'
          },
          signal: controller.signal
        }
      );

      clearTimeout(timeout);

      if (geoRes.ok) {
        const data = await geoRes.json();
        const addr = data.address || {};
        const cityName =
          addr.city ||
          addr.town ||
          addr.municipality ||
          addr.suburb ||
          addr.village ||
          addr.county ||
          'Current Location';
        const stateName = addr.state || addr.state_district || '';
        const countryName = addr.country || '';

        const displayParts = [cityName];
        if (stateName && stateName !== cityName) displayParts.push(stateName);
        else if (countryName && countryName !== cityName) displayParts.push(countryName);

        locationInfo = {
          name: cityName,
          state: stateName,
          country: countryName,
          displayName: displayParts.join(', ')
        };
      }
    } catch (fetchErr) {
      clearTimeout(timeout);
      console.warn('[Reverse Geocode Fetch Notice]: Falling back to Current Location label', fetchErr);
    }

    geocodeCache.set(cacheKey, { data: locationInfo, timestamp: now });
    return res.json(locationInfo);
  } catch (error: any) {
    console.error('[Reverse Geocode Error]:', error);
    return res.json({
      name: 'Current Location',
      state: '',
      country: '',
      displayName: 'Current Location'
    });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`WeatherGPT server active on http://0.0.0.0:${PORT}`);
  });
}

startServer();
