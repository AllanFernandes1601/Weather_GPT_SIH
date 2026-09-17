import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Map as MapLibreMap,
  NavigationControl,
  ScaleControl,
  setWorkerUrl,
  type GeoJSONSource,
  type MapLayerMouseEvent
} from 'maplibre-gl';
import type { FeatureCollection, LineString, Point } from 'geojson';
import 'maplibre-gl/dist/maplibre-gl.css';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { HourlyForecastItem, LocationData } from '../types';
import { LOCATIONS } from '../data/mockWeatherData';
import { DistrictFloodContext, riskService } from '../services/riskService';
import { NationalWeatherStation } from '../services/nationalWeatherService';
import { calculateRiskFromInputs, RiskAssessment, RiskKind, RiskLevel } from '../utils/riskEngine';

setWorkerUrl(maplibreWorkerUrl);

export type DisasterMapLayer = 'overview' | 'rain' | 'flood' | 'heat' | 'aqi' | 'cyclone';

interface DisasterMapProps {
  location: LocationData;
  hourlyForecast: HourlyForecastItem[];
  floodContext: DistrictFloodContext | null;
  layer: DisasterMapLayer;
  selectedHour: number;
  selectedLocationId: string;
  nationalStations: NationalWeatherStation[];
  onSelectLocation: (id: string) => void;
}

interface MapStation {
  location: LocationData;
  assessments: Record<RiskKind, RiskAssessment>;
  overviewAssessment: RiskAssessment;
  isActiveLocation: boolean;
}

const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
const TERRAIN_URL = 'https://tiles.mapterhorn.com/tilejson.json';
const INDIA_CENTER: [number, number] = [79.4, 22.4];

const levelColor: Record<RiskLevel, string> = {
  Low: '#10b981',
  Moderate: '#f59e0b',
  High: '#f97316',
  Severe: '#ef4444',
  Unavailable: '#94a3b8'
};

const layerKind: Partial<Record<DisasterMapLayer, RiskKind>> = {
  rain: 'rain',
  flood: 'flood',
  heat: 'heat',
  aqi: 'aqi'
};

const cycloneCoordinates: Array<[number, number]> = [
  [91.5, 8.5], [89.5, 10.5], [87.3, 13.5], [84.9, 16.5], [83, 19.2], [82, 21]
];

function stationValue(station: MapStation, layer: DisasterMapLayer): RiskAssessment {
  return layer === 'overview' ? station.overviewAssessment : station.assessments[layerKind[layer] ?? 'rain'];
}

function intensityFor(station: MapStation, layer: DisasterMapLayer, forecast?: HourlyForecastItem): number {
  if (layer === 'rain') {
    const timelineSignal = station.isActiveLocation ? (forecast?.rainProbability ?? 0) : 0;
    return Math.max(station.location.precipitation.dailyTotalMm * 1.7, timelineSignal);
  }
  if (layer === 'overview') return station.overviewAssessment.gaugeValue;
  if (layer === 'heat') return Math.max(0, (station.location.high - 25) * 7);
  if (layer === 'aqi') return Math.min(100, station.location.airQuality.aqi / 2.5);
  if (layer === 'flood') return station.assessments.flood.gaugeValue;
  return 28;
}

export const DisasterMap: React.FC<DisasterMapProps> = ({
  location,
  hourlyForecast,
  floodContext,
  layer,
  selectedHour,
  selectedLocationId,
  nationalStations,
  onSelectLocation
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const onSelectRef = useRef(onSelectLocation);
  const [mapReady, setMapReady] = useState(false);
  const [mapUnavailable, setMapUnavailable] = useState(false);
  const [isLocalView, setIsLocalView] = useState(false);

  useEffect(() => { onSelectRef.current = onSelectLocation; }, [onSelectLocation]);

  const stations = useMemo<MapStation[]>(() => {
    const liveGridLocations: LocationData[] = nationalStations.map(station => ({
      id: `grid-${station.id}`,
      name: station.name,
      state: station.state,
      coordinates: `${station.latitude.toFixed(2)}° N, ${station.longitude.toFixed(2)}° E`,
      latitude: station.latitude,
      longitude: station.longitude,
      isLive: station.isLive,
      dataSource: 'Open-Meteo nationwide grid',
      temperature: station.temperatureC ?? 0,
      condition: 'Live forecast point',
      feelsLike: station.apparentTemperatureC ?? station.temperatureC ?? 0,
      high: station.maxTemperatureC ?? station.temperatureC ?? 0,
      low: station.minTemperatureC ?? station.temperatureC ?? 0,
      greeting: '',
      humidity: station.humidityPercent ?? 0,
      humidityDesc: 'Live forecast',
      windSpeed: 0,
      windDirection: 'N/A',
      windGusts: station.windGustKmh ?? 0,
      uvIndex: 0,
      uvCategory: 'Unavailable',
      visibility: 0,
      pressure: 0,
      pressureTendency: 'Unavailable',
      radarStation: 'Not connected',
      convectiveCell: 'Not available',
      airQuality: {
        aqi: station.aqi ?? Number.NaN,
        status: station.aqi === null ? 'Unavailable' : 'Live',
        pm25: station.pm25 ?? 0,
        pm10: station.pm10 ?? 0,
        description: 'Open-Meteo air-quality forecast'
      },
      solarCycle: { daylightDuration: 'Unavailable', sunrise: '', sunset: '', progressPercentage: 0 },
      precipitation: {
        dailyTotalMm: station.rainMm24h ?? 0,
        dewPoint: 0,
        description: 'Open-Meteo daily forecast accumulation'
      }
    }));
    const matchingGridLocation = (item: LocationData) =>
      item.name.toLowerCase() === location.name.toLowerCase() ||
      (item.latitude !== undefined && item.longitude !== undefined && location.latitude !== undefined && location.longitude !== undefined &&
        Math.abs(item.latitude - location.latitude) < 0.08 && Math.abs(item.longitude - location.longitude) < 0.08);
    const activeLocationHasCoordinates = Number.isFinite(location.latitude) && Number.isFinite(location.longitude);
    const knownLocations = nationalStations.length > 0
      ? activeLocationHasCoordinates
        ? [location, ...liveGridLocations.filter(item => !matchingGridLocation(item))]
        : liveGridLocations
      : [location, ...LOCATIONS.filter(item => item.id !== location.id && item.name !== location.name)];
    return knownLocations
      .filter(item => item.latitude !== undefined && item.longitude !== undefined)
      .map(item => {
        const isActiveLocation = item.id === location.id || item.name.toLowerCase() === location.name.toLowerCase();
        const result = calculateRiskFromInputs(riskService.toLiveInputs(item, isActiveLocation ? floodContext : null));
        return {
          location: item,
          assessments: result.assessments,
          overviewAssessment: result.highestAvailableRisk,
          isActiveLocation
        };
      });
  }, [location, floodContext, nationalStations]);

  const forecast = hourlyForecast[selectedHour] ?? hourlyForecast[0];
  const selectedStation = stations.find(item => item.location.id === selectedLocationId)
    ?? stations.find(item => item.location.id === `grid-${selectedLocationId}`)
    ?? stations.find(item => item.isActiveLocation)
    ?? stations[0];
  const selectedAssessment = stationValue(selectedStation, layer);
  const selectedLevel: RiskLevel = layer === 'cyclone' ? 'Unavailable' : selectedAssessment.level;
  const selectedValue = layer === 'cyclone'
    ? 'Historical reference'
    : selectedAssessment.displayValue;
  const selectedReason = layer === 'cyclone'
    ? 'Illustrative historical Bay of Bengal track; no live cyclone feed or current storm is implied.'
    : selectedAssessment.reason;

  const stationGeoJson = useMemo<FeatureCollection<Point>>(() => ({
    type: 'FeatureCollection',
    features: stations.map(station => {
      const assessment = stationValue(station, layer);
      return {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [station.location.longitude!, station.location.latitude!]
        },
        properties: {
          id: station.location.id,
          name: station.location.name,
          value: assessment.displayValue,
          color: levelColor[layer === 'cyclone' ? 'Unavailable' : assessment.level],
          intensity: intensityFor(station, layer, forecast),
          selected: station.location.id === selectedStation.location.id ? 1 : 0
        }
      };
    })
  }), [stations, layer, forecast, selectedStation.location.id]);

  const cycloneGeoJson = useMemo<FeatureCollection<LineString>>(() => ({
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: cycloneCoordinates },
      properties: { reference: 'Historical interface reference' }
    }]
  }), []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new MapLibreMap({
      container: containerRef.current,
      style: STYLE_URL,
      center: INDIA_CENTER,
      zoom: 4.1,
      pitch: 42,
      bearing: -7,
      minZoom: 3,
      maxZoom: 16,
      maxPitch: 75,
      canvasContextAttributes: { antialias: true }
    });
    mapRef.current = map;
    map.addControl(new NavigationControl({ visualizePitch: true }), 'top-right');
    map.addControl(new ScaleControl({ unit: 'metric' }), 'bottom-right');

    const loadTimeout = window.setTimeout(() => {
      if (!map.loaded()) setMapUnavailable(true);
    }, 12000);

    map.on('load', () => {
      window.clearTimeout(loadTimeout);
      setMapUnavailable(false);
      setMapReady(true);

      try {
        map.addSource('weathergpt-terrain', {
          type: 'raster-dem',
          url: TERRAIN_URL,
          tileSize: 512,
          maxzoom: 14
        });
        map.setTerrain({ source: 'weathergpt-terrain', exaggeration: 1.35 });
        map.addLayer({
          id: 'weathergpt-hillshade',
          type: 'hillshade',
          source: 'weathergpt-terrain',
          paint: {
            'hillshade-shadow-color': '#0f172a',
            'hillshade-highlight-color': '#dbeafe',
            'hillshade-exaggeration': 0.28
          }
        });
      } catch (error) {
        console.warn('[Map Terrain Notice]: 3D terrain unavailable; continuing with vector geography.', error);
      }

      const vectorSource = Object.entries(map.getStyle().sources).find(([, source]) => source.type === 'vector');
      if (vectorSource && !map.getLayer('weathergpt-3d-buildings')) {
        try {
          const firstLabelLayer = map.getStyle().layers.find(item => item.type === 'symbol' && item.layout?.['text-field']);
          map.addLayer({
            id: 'weathergpt-3d-buildings',
            source: vectorSource[0],
            'source-layer': 'building',
            type: 'fill-extrusion',
            minzoom: 13,
            filter: ['!=', ['get', 'hide_3d'], true],
            paint: {
              'fill-extrusion-color': '#d9d7cf',
              'fill-extrusion-height': ['coalesce', ['get', 'render_height'], ['get', 'height'], 8],
              'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], ['get', 'min_height'], 0],
              'fill-extrusion-opacity': 0.72
            }
          }, firstLabelLayer?.id);
        } catch (error) {
          console.warn('[Map Buildings Notice]: 3D building layer unavailable for this style.', error);
        }
      }

      map.addSource('weathergpt-stations', { type: 'geojson', data: stationGeoJson });
      map.addLayer({
        id: 'weathergpt-risk-heatmap',
        type: 'heatmap',
        source: 'weathergpt-stations',
        maxzoom: 9,
        paint: {
          'heatmap-weight': ['interpolate', ['linear'], ['get', 'intensity'], 0, 0.05, 100, 1],
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 3, 0.75, 7, 1.25],
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 3, 24, 7, 58],
          'heatmap-opacity': layer === 'cyclone' || layer === 'flood' ? 0 : 0.62,
          'heatmap-color': [
            'interpolate', ['linear'], ['heatmap-density'],
            0, 'rgba(14,116,144,0)',
            0.2, 'rgba(34,211,238,0.34)',
            0.42, 'rgba(16,185,129,0.52)',
            0.62, 'rgba(250,204,21,0.66)',
            0.8, 'rgba(249,115,22,0.78)',
            1, 'rgba(239,68,68,0.9)'
          ]
        }
      });
      map.addLayer({
        id: 'weathergpt-risk-halo',
        type: 'circle',
        source: 'weathergpt-stations',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['get', 'intensity'], 0, 18, 100, 78],
          'circle-color': ['get', 'color'],
          'circle-opacity': layer === 'cyclone' ? 0.04 : 0.2,
          'circle-blur': 0.72,
          'circle-pitch-alignment': 'map'
        }
      });
      map.addLayer({
        id: 'weathergpt-risk-points',
        type: 'circle',
        source: 'weathergpt-stations',
        paint: {
          'circle-radius': ['case', ['==', ['get', 'selected'], 1], 10, 7],
          'circle-color': ['get', 'color'],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': ['case', ['==', ['get', 'selected'], 1], 3, 2],
          'circle-opacity': 0.98
        }
      });
      map.addLayer({
        id: 'weathergpt-station-labels',
        type: 'symbol',
        source: 'weathergpt-stations',
        layout: {
          'text-field': ['concat', ['get', 'name'], '\n', ['get', 'value']],
          'text-size': 12,
          'text-font': ['Noto Sans Regular'],
          'text-offset': [0, 1.65],
          'text-anchor': 'top',
          'text-allow-overlap': false,
          'text-optional': true,
          'symbol-sort-key': ['get', 'intensity']
        },
        paint: {
          'text-color': '#f8fafc',
          'text-halo-color': '#07111b',
          'text-halo-width': 2
        }
      });

      map.addSource('weathergpt-cyclone', { type: 'geojson', data: cycloneGeoJson });
      map.addLayer({
        id: 'weathergpt-cyclone-track',
        type: 'line',
        source: 'weathergpt-cyclone',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#f8fafc',
          'line-width': 4,
          'line-opacity': layer === 'cyclone' || layer === 'overview' ? 0.9 : 0,
          'line-dasharray': [1.5, 2.2]
        }
      });

      map.on('mouseenter', 'weathergpt-risk-points', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'weathergpt-risk-points', () => { map.getCanvas().style.cursor = ''; });
      map.on('click', 'weathergpt-risk-points', (event: MapLayerMouseEvent) => {
        const feature = event.features?.[0];
        const id = feature?.properties?.id;
        if (!id || feature.geometry.type !== 'Point') return;
        onSelectRef.current(String(id));
        map.flyTo({ center: feature.geometry.coordinates as [number, number], zoom: 13.25, pitch: 62, bearing: -18, duration: 1400 });
        setIsLocalView(true);
      });
    });

    return () => {
      window.clearTimeout(loadTimeout);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    (map.getSource('weathergpt-stations') as GeoJSONSource | undefined)?.setData(stationGeoJson);
    if (map.getLayer('weathergpt-risk-halo')) {
      map.setPaintProperty('weathergpt-risk-halo', 'circle-opacity', layer === 'cyclone' ? 0.04 : layer === 'overview' ? 0.14 : 0.25);
    }
    if (map.getLayer('weathergpt-risk-heatmap')) {
      map.setPaintProperty('weathergpt-risk-heatmap', 'heatmap-opacity', layer === 'cyclone' || layer === 'flood' ? 0 : layer === 'overview' ? 0.48 : 0.68);
    }
    if (map.getLayer('weathergpt-cyclone-track')) {
      map.setPaintProperty('weathergpt-cyclone-track', 'line-opacity', layer === 'cyclone' || layer === 'overview' ? 0.9 : 0);
    }
  }, [stationGeoJson, layer, mapReady]);

  const resetIndiaView = () => {
    mapRef.current?.flyTo({ center: INDIA_CENTER, zoom: 4.1, pitch: 42, bearing: -7, duration: 1100 });
    setIsLocalView(false);
  };

  return (
    <div className="disaster-map-shell relative min-h-[620px] overflow-hidden rounded-[28px] border border-white/10 bg-[#08131e] shadow-2xl">
      <div className="absolute inset-0">
        <div ref={containerRef} className="h-full w-full" aria-label={`Interactive ${layer} disaster intelligence map of India`} />
      </div>

      {!mapReady && !mapUnavailable && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#08131e] text-white">
          <div className="text-center"><span className="material-symbols-outlined animate-spin text-[36px] text-cyan-300">progress_activity</span><p className="mt-2 text-[12px] font-semibold">Loading real geographic map…</p></div>
        </div>
      )}
      {mapUnavailable && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[radial-gradient(circle_at_center,#153852,#06111b)] p-6 text-center text-white">
          <div className="max-w-sm"><span className="material-symbols-outlined text-[38px] text-amber-300">cloud_off</span><h3 className="mt-2 text-[18px] font-bold">Map tiles unavailable</h3><p className="mt-2 text-[12px] text-slate-300">Risk calculations and surrounding panels still work. Reconnect to the internet and reopen this page to load geographic tiles.</p></div>
        </div>
      )}

      <div className="pointer-events-none absolute left-4 top-4 z-20 rounded-2xl border border-white/10 bg-[#08131e]/84 px-4 py-3 text-white shadow-xl backdrop-blur-xl">
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-cyan-200">
          <span className="relative flex h-2 w-2"><span className="absolute h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" /><span className="relative h-2 w-2 rounded-full bg-emerald-400" /></span>
          WeatherGPT spatial intelligence
        </div>
        <p className="mt-1 text-[12px] text-slate-300">{stations.length} India locations · {forecast?.time ?? 'Current'} context</p>
      </div>

      {isLocalView && (
        <button type="button" onClick={resetIndiaView} className="absolute right-14 top-4 z-20 flex items-center gap-1.5 rounded-full border border-white/15 bg-[#08131e]/86 px-3 py-2 text-[11px] font-bold text-white shadow-lg backdrop-blur-xl transition hover:bg-[#10263a]">
          <span className="material-symbols-outlined text-[16px]">public</span> India view
        </button>
      )}

      <div className="absolute bottom-5 left-4 right-4 z-20 flex max-w-[370px] flex-col gap-2 rounded-2xl border border-white/10 bg-[#08131e]/90 p-4 text-white shadow-2xl backdrop-blur-xl sm:right-auto">
        <div className="flex items-start justify-between gap-4">
          <div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">Selected station</p><h3 className="mt-1 text-[18px] font-bold">{selectedStation.location.name}</h3></div>
          <span className="rounded-full px-2.5 py-1 text-[10px] font-bold" style={{ color: levelColor[selectedLevel], backgroundColor: `${levelColor[selectedLevel]}20` }}>{layer === 'cyclone' ? 'Reference' : selectedLevel}</span>
        </div>
        <div className="flex items-end justify-between gap-4">
          <div><p className="text-[22px] font-bold">{selectedValue}</p><p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-slate-300">{selectedReason}</p></div>
          <span className="material-symbols-outlined text-[28px] text-cyan-200">{layer === 'overview' ? 'crisis_alert' : layer === 'cyclone' ? 'cyclone' : selectedAssessment.icon}</span>
        </div>
        <p className="border-t border-white/10 pt-2 text-[10px] italic text-slate-400">{layer === 'cyclone' ? 'WeatherGPT historical track reference' : selectedAssessment.source} · {selectedStation.location.isLive ? 'live forecast input' : 'fallback/reference input'}</p>
      </div>

      <div className="pointer-events-none absolute bottom-5 right-12 z-20 hidden rounded-full border border-white/10 bg-[#08131e]/78 px-3 py-1.5 text-[10px] text-slate-200 backdrop-blur-lg md:block">Real OpenStreetMap geography · advisory layers are not official warnings</div>
    </div>
  );
};
