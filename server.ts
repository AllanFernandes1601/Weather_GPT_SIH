import express from 'express';
import path from 'path';
import { spawn } from 'child_process';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;

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
const BENGALURU_LATITUDE = 12.9716;
const BENGALURU_LONGITUDE = 77.5946;
const BENGALURU_MODEL_RADIUS_KM = 30;
const ML_PYTHON_BIN = process.env.ML_PYTHON_BIN || 'python3';
const RAIN_PREDICT_SCRIPT = path.join(process.cwd(), 'ml', 'scripts', 'predict_rain.py');

interface RainPrediction {
  probability: number;
  willRain: boolean;
  threshold: number;
  observedAt: string;
  modelScope: 'Bengaluru';
}

app.use(express.json());

function isWithinBengaluruModelArea(latitude: number, longitude: number): boolean {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = toRadians(latitude - BENGALURU_LATITUDE);
  const longitudeDelta = toRadians(longitude - BENGALURU_LONGITUDE);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(toRadians(BENGALURU_LATITUDE)) *
      Math.cos(toRadians(latitude)) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) <= BENGALURU_MODEL_RADIUS_KM;
}

function predictBengaluruRain(weather: unknown): Promise<RainPrediction> {
  return new Promise((resolve, reject) => {
    const process = spawn(ML_PYTHON_BIN, [RAIN_PREDICT_SCRIPT], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    let settled = false;

    const finish = (error?: Error, prediction?: RainPrediction) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (error) reject(error);
      else resolve(prediction!);
    };
    const timeout = setTimeout(() => {
      process.kill();
      finish(new Error('Rain prediction timed out'));
    }, 8000);

    process.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    process.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    process.on('error', (error) => finish(error));
    process.on('close', (code) => {
      if (code !== 0) {
        finish(new Error(`Rain prediction process exited with code ${code}: ${stderr.trim()}`));
        return;
      }
      try {
        const prediction = JSON.parse(stdout) as RainPrediction;
        if (typeof prediction.probability !== 'number' || typeof prediction.willRain !== 'boolean') {
          throw new Error('Rain prediction returned an invalid response');
        }
        finish(undefined, prediction);
      } catch (error: any) {
        finish(error instanceof Error ? error : new Error(String(error)));
      }
    });

    process.stdin.end(JSON.stringify({ weather }));
  });
}

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
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

    // Cache key rounded to 3 decimal places (~110 meters precision)
    const cacheKey = `${latitude.toFixed(3)},${longitude.toFixed(3)}`;
    const now = Date.now();

    const cached = weatherCache.get(cacheKey);
    if (cached && now - cached.timestamp < WEATHER_CACHE_TTL_MS) {
      return res.json({ ...cached.data, cached: true });
    }

    // Fetch Open-Meteo forecast and air quality concurrently
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,apparent_temperature,relative_humidity_2m,dew_point_2m,precipitation,rain,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m,surface_pressure,visibility,uv_index,is_day&hourly=temperature_2m,apparent_temperature,precipitation_probability,precipitation,rain,weather_code,cloud_cover,wind_speed_10m,wind_gusts_10m,wind_direction_10m,relative_humidity_2m,surface_pressure,visibility,dew_point_2m,is_day&daily=temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_sum,precipitation_probability_max,weather_code&timezone=auto&past_hours=6&forecast_days=2`;
    const airQualityUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${latitude}&longitude=${longitude}&current=pm10,pm2_5,european_aqi,us_aqi`;

    const [weatherRes, airQualityRes] = await Promise.allSettled([
      fetch(weatherUrl, { headers: { 'User-Agent': 'WeatherGPT-App/1.0' } }),
      fetch(airQualityUrl, { headers: { 'User-Agent': 'WeatherGPT-App/1.0' } })
    ]);

    if (weatherRes.status !== 'fulfilled' || !weatherRes.value.ok) {
      const errorMsg = weatherRes.status === 'fulfilled' 
        ? `Open-Meteo returned status ${weatherRes.value.status}`
        : (weatherRes.reason?.message || 'Network error connecting to Open-Meteo');
      console.error('[Open-Meteo Forecast Error]:', errorMsg);
      return res.status(502).json({
        error: 'Failed to fetch meteorological data from Open-Meteo',
        details: errorMsg
      });
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

    let rainPrediction: RainPrediction | null = null;
    if (isWithinBengaluruModelArea(latitude, longitude)) {
      try {
        rainPrediction = await predictBengaluruRain(weatherData);
      } catch (predictionError) {
        console.warn('[Rain Prediction Notice]: Prediction unavailable', predictionError);
      }
    }

    const payload = {
      weather: weatherData,
      airQuality: airQualityData,
      rainPrediction,
      source: 'Open-Meteo',
      retrievedAt: new Date().toISOString()
    };

    // Store in short-lived memory cache
    weatherCache.set(cacheKey, { data: payload, timestamp: now });

    // Clean up stale cache entries periodically
    if (weatherCache.size > 200) {
      for (const [key, entry] of weatherCache.entries()) {
        if (now - entry.timestamp > WEATHER_CACHE_TTL_MS) {
          weatherCache.delete(key);
        }
      }
    }

    return res.json(payload);
  } catch (error: any) {
    console.error('[Weather API Unexpected Error]:', error);
    return res.status(500).json({
      error: 'Internal server error while processing weather request',
      message: error?.message || 'Unknown error'
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

    const cacheKey = query.toLowerCase();
    const now = Date.now();

    const cached = geocodeSearchCache.get(cacheKey);
    if (cached && now - cached.timestamp < GEOCODE_CACHE_TTL_MS) {
      return res.json(cached.data);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    try {
      const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`;
      const response = await fetch(geoUrl, {
        headers: {
          'User-Agent': 'WeatherGPT-Applet/1.0 (weathergpt@local)'
        },
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`Open-Meteo geocoding responded with HTTP ${response.status}`);
      }

      const data = await response.json();
      const rawResults = data.results || [];

      const cleanResults = rawResults.map((item: any) => {
        const name = item.name || '';
        const state = item.admin1 || item.admin2 || '';
        const country = item.country || '';
        const latitude = item.latitude;
        const longitude = item.longitude;

        const parts: string[] = [name];
        if (state && state !== name) parts.push(state);
        if (country && country !== name) parts.push(country);

        return {
          name,
          state,
          country,
          latitude,
          longitude,
          displayName: parts.join(', ')
        };
      });

      geocodeSearchCache.set(cacheKey, { data: cleanResults, timestamp: now });

      // Clean up stale cache entries periodically
      if (geocodeSearchCache.size > 200) {
        for (const [key, entry] of geocodeSearchCache.entries()) {
          if (now - entry.timestamp > GEOCODE_CACHE_TTL_MS) {
            geocodeSearchCache.delete(key);
          }
        }
      }

      return res.json(cleanResults);
    } catch (fetchErr: any) {
      clearTimeout(timeout);
      console.warn('[Geocoding Search Fetch Warning]:', fetchErr?.message || fetchErr);
      return res.status(502).json({
        error: 'Geocoding service unavailable',
        message: fetchErr?.message || 'Failed to fetch coordinates'
      });
    }
  } catch (error: any) {
    console.error('[Geocoding Search Unexpected Error]:', error);
    return res.status(500).json({
      error: 'Internal server error while searching locations',
      message: error?.message || 'Unknown error'
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
