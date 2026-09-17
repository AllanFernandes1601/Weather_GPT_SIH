import { lazy, Suspense, useState, useEffect, useCallback } from 'react';
import { NavTab, LocationData, HourlyForecastItem, RemoteLocationResult } from './types';
import { LOCATIONS, ACTIVE_ALERT } from './data/mockWeatherData';
import { buildFallbackHourlyForecast, weatherService } from './services/weatherService';
import { Navbar } from './components/Navbar';
import { WeatherHero } from './components/WeatherHero';
import { AIWeatherInput } from './components/AIWeatherInput';
import { HourlyForecast } from './components/HourlyForecast';
import { WeatherDetails } from './components/WeatherDetails';
import { ExploreSection } from './components/ExploreSection';
import { LocationModal } from './components/LocationModal';
import { SearchModal } from './components/SearchModal';
import { AlertModal } from './components/AlertModal';
import { FloatingWeatherAssistant } from './components/FloatingWeatherAssistant';
import { PlaceholderPage } from './pages/PlaceholderPage';
import { RisksPage } from './pages/RisksPage';
import { useVoiceCapture } from './hooks/useVoiceCapture';
import { buildWeatherGPTLiveWeather } from './services/aiWeatherService';
import { LanguageId } from '../languageConfig';

const DisasterMapPage = lazy(() => import('./pages/DisasterMapPage').then(module => ({ default: module.DisasterMapPage })));

export default function App() {
  const [currentTab, setCurrentTab] = useState<NavTab>('home');
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = window.localStorage.getItem('weathergpt-theme');
    return saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const [activeLocation, setActiveLocation] = useState<LocationData>(LOCATIONS[0]);
  const [hourlyForecast, setHourlyForecast] = useState<HourlyForecastItem[]>(() => buildFallbackHourlyForecast());
  const [isLoadingWeather, setIsLoadingWeather] = useState(false);
  const [, setWeatherError] = useState<string | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageId>('auto');

  const voiceContext = {
    locationName: activeLocation.name,
    stateName: activeLocation.state,
    coordinates: activeLocation.coordinates,
    latitude: activeLocation.latitude,
    longitude: activeLocation.longitude,
    liveWeather: buildWeatherGPTLiveWeather(activeLocation) as unknown as Record<string, unknown>,
    hourlyForecast: hourlyForecast.slice(0, 48).map((item) => ({
      time: item.forecastTime || item.time,
      temperatureC: item.temperature,
      condition: item.condition,
      rainProbabilityPercent: item.rainProbability
    })),
    alert: ACTIVE_ALERT as unknown as Record<string, unknown>,
    language: selectedLanguage
  };

  const {
    isVoiceActive,
    voiceError,
    toggleVoiceCapture,
    clearVoiceError,
    diagnostics,
    liveState,
    liveTranscript,
    playbackState
  } = useVoiceCapture(voiceContext);

  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);

  const [isLocatingUser, setIsLocatingUser] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Load live weather telemetry from Open-Meteo backend for a specific station or coordinates
  const fetchWeatherForStation = useCallback(async (location: LocationData) => {
    setIsLoadingWeather(true);
    setWeatherError(null);

    try {
      let result;
      if (location.latitude !== undefined && location.longitude !== undefined) {
        result = await weatherService.getWeatherByCoordinates(
          location.latitude,
          location.longitude,
          {
            id: location.id,
            name: location.name,
            state: location.state,
            coordinates: location.coordinates
          }
        );
      } else {
        result = await weatherService.getWeatherByLocationId(location.id);
      }
      setActiveLocation(result.location);
      if (result.hourly && result.hourly.length > 0) {
        setHourlyForecast(result.hourly);
      }
    } catch (err: any) {
      console.warn('[Weather Load Warning]: Falling back to baseline data', err);
      setWeatherError('Unable to refresh weather. Displaying offline station values.');
    } finally {
      setIsLoadingWeather(false);
    }
  }, []);

  // Initial load: retrieve real Open-Meteo data for the default station (Bengaluru)
  useEffect(() => {
    fetchWeatherForStation(LOCATIONS[0]);
  }, [fetchWeatherForStation]);

  useEffect(() => {
    document.documentElement.classList.toggle('weather-dark', isDarkMode);
    window.localStorage.setItem('weathergpt-theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  // Global keyboard shortcut for ⌘K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchModalOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSelectLocation = (loc: LocationData) => {
    setActiveLocation(loc);
    fetchWeatherForStation(loc);
  };

  // Query live Open-Meteo weather for a dynamically searched geocoded location
  const handleSelectRemoteLocation = async (remote: RemoteLocationResult) => {
    setIsLoadingWeather(true);
    setWeatherError(null);

    try {
      const coordStr = `${Math.abs(remote.latitude).toFixed(2)}° ${remote.latitude >= 0 ? 'N' : 'S'}, ${Math.abs(remote.longitude).toFixed(2)}° ${remote.longitude >= 0 ? 'E' : 'W'}`;
      const stateLabel = remote.state
        ? (remote.country && remote.country !== remote.state ? `${remote.state}, ${remote.country}` : remote.state)
        : remote.country;

      const result = await weatherService.getWeatherByCoordinates(
        remote.latitude,
        remote.longitude,
        {
          id: `geo-${remote.latitude.toFixed(4)}-${remote.longitude.toFixed(4)}`,
          name: remote.name,
          state: stateLabel,
          coordinates: coordStr
        }
      );

      setActiveLocation(result.location);
      if (result.hourly && result.hourly.length > 0) {
        setHourlyForecast(result.hourly);
      }
    } catch (err: any) {
      console.error('[Remote Location Weather Error]:', err);
      setWeatherError(`Failed to retrieve live weather for ${remote.name}.`);
    } finally {
      setIsLoadingWeather(false);
    }
  };

  // "Use My Current Location" via HTML5 Geolocation API with reverse geocoding & Open-Meteo query
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser.');
      return;
    }

    setIsLocatingUser(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;

          // 1. Reverse-geocode coordinates via backend to obtain human-readable city & state
          const geoInfo = await weatherService.reverseGeocode(latitude, longitude);

          // 2. Fetch live Open-Meteo weather for coordinates
          const result = await weatherService.getWeatherByCoordinates(latitude, longitude, {
            name: geoInfo.name || 'Current Location',
            state: geoInfo.state || '',
            coordinates: `${Math.abs(latitude).toFixed(2)}° ${latitude >= 0 ? 'N' : 'S'}, ${Math.abs(longitude).toFixed(2)}° ${longitude >= 0 ? 'E' : 'W'}`
          });

          setActiveLocation(result.location);
          if (result.hourly && result.hourly.length > 0) {
            setHourlyForecast(result.hourly);
          }
          setIsLocationModalOpen(false);
        } catch (err: any) {
          console.error('[Current Location Weather Error]:', err);
          setLocationError('Failed to retrieve meteorological telemetry for your location.');
        } finally {
          setIsLocatingUser(false);
        }
      },
      (error) => {
        console.warn('[Geolocation Permission/Access Error]:', error.message);
        let message = 'Location access unavailable. Displaying selected station.';
        if (error.code === error.PERMISSION_DENIED) {
          message = 'Location permission was denied. You can select any station manually.';
        } else if (error.code === error.TIMEOUT) {
          message = 'Location request timed out. Please retry or pick a station.';
        }
        setLocationError(message);
        setIsLocatingUser(false);
      },
      {
        enableHighAccuracy: false,
        timeout: 8000,
        maximumAge: 60000
      }
    );
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#1C1814] flex flex-col justify-between selection:bg-[#B45309] selection:text-white">
      {/* 1. TOP APP HEADER NAVBAR */}
      <Navbar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        activeLocation={activeLocation}
        onOpenLocationModal={() => setIsLocationModalOpen(true)}
        onOpenSearchModal={() => setIsSearchModalOpen(true)}
        onOpenAlertModal={() => setIsAlertModalOpen(true)}
        isDarkMode={isDarkMode}
        onToggleDarkMode={() => setIsDarkMode(value => !value)}
      />

      {/* 2. MAIN VIEW CONTAINER */}
      <main className="w-full pt-24 sm:pt-28 pb-16 bg-[#FAF8F5] flex-1">
        <div className="w-full max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8">
          {currentTab === 'home' ? (
            <div className="space-y-10">
              {/* Section 1: Current Weather Hero */}
              <WeatherHero
                location={activeLocation}
                isVoiceActive={isVoiceActive}
                onToggleVoice={toggleVoiceCapture}
                onOpenLocationModal={() => setIsLocationModalOpen(true)}
                isLoading={isLoadingWeather}
              />

              {/* Ask WeatherGPT AI Hub with Voice-to-Cloud Integration */}
              <div id="ask-weathergpt" className="scroll-mt-28">
                <AIWeatherInput
                  location={activeLocation}
                  hourlyForecast={hourlyForecast}
                  locationName={activeLocation.name}
                  latitude={activeLocation.latitude}
                  longitude={activeLocation.longitude}
                  isVoiceActive={isVoiceActive}
                  onToggleVoice={toggleVoiceCapture}
                  voiceError={voiceError}
                  onClearVoiceError={clearVoiceError}
                  diagnostics={diagnostics}
                  liveState={liveState}
                  liveTranscript={liveTranscript}
                  playbackState={playbackState}
                  selectedLanguage={selectedLanguage}
                  onLanguageChange={setSelectedLanguage}
                />
              </div>

              {/* Section 4: Today's Hourly Forecast */}
              <HourlyForecast
                forecastItems={hourlyForecast}
                isLive={activeLocation.isLive}
              />

              {/* Section 5: Detailed Weather Metrics Bento Grid */}
              <WeatherDetails location={activeLocation} />

              {/* Section 6: Explore & Specialized Weather Sections */}
              <ExploreSection onNavigate={(tab) => setCurrentTab(tab)} />
            </div>
          ) : currentTab === 'risks' ? (
            <RisksPage
              location={activeLocation}
              onBackToHome={() => setCurrentTab('home')}
            />
          ) : currentTab === 'weather-map' ? (
            <Suspense fallback={(
              <div className="flex min-h-[520px] items-center justify-center rounded-3xl border border-[#E5DCCF] bg-[#FFFDF9]">
                <div className="text-center text-[#6E645A]">
                  <span className="material-symbols-outlined animate-spin text-[36px] text-cyan-600">progress_activity</span>
                  <p className="mt-2 text-[13px] font-semibold">Loading disaster map…</p>
                </div>
              </div>
            )}>
              <DisasterMapPage
                location={activeLocation}
                hourlyForecast={hourlyForecast}
                onBackToHome={() => setCurrentTab('home')}
              />
            </Suspense>
          ) : (
            <PlaceholderPage
              tab={currentTab}
              location={activeLocation}
              onBackToHome={() => setCurrentTab('home')}
              onOpenAlertModal={() => setIsAlertModalOpen(true)}
            />
          )}
        </div>
      </main>

      <FloatingWeatherAssistant
        location={activeLocation}
        currentTab={currentTab}
        isLoading={isLoadingWeather}
      >
        <AIWeatherInput
          location={activeLocation}
          hourlyForecast={hourlyForecast}
          locationName={activeLocation.name}
          latitude={activeLocation.latitude}
          longitude={activeLocation.longitude}
          isVoiceActive={isVoiceActive}
          onToggleVoice={toggleVoiceCapture}
          voiceError={voiceError}
          onClearVoiceError={clearVoiceError}
          diagnostics={diagnostics}
          liveState={liveState}
          liveTranscript={liveTranscript}
          playbackState={playbackState}
          selectedLanguage={selectedLanguage}
          onLanguageChange={setSelectedLanguage}
          compact
        />
      </FloatingWeatherAssistant>

      {/* 3. MODALS */}
      <LocationModal
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
        activeLocation={activeLocation}
        onSelectLocation={handleSelectLocation}
        onSelectRemoteLocation={handleSelectRemoteLocation}
        onUseCurrentLocation={handleUseCurrentLocation}
        isLocatingUser={isLocatingUser}
        locationError={locationError}
        onClearLocationError={() => setLocationError(null)}
      />

      <SearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        onSelectLocation={handleSelectLocation}
        onSelectRemoteLocation={handleSelectRemoteLocation}
        onOpenAlertModal={() => setIsAlertModalOpen(true)}
      />

      <AlertModal
        isOpen={isAlertModalOpen}
        onClose={() => setIsAlertModalOpen(false)}
        alert={ACTIVE_ALERT}
      />

      {/* 4. FOOTER */}
      <footer className="w-full border-t border-[#E5DCCF]/80 bg-[#FFFDF9] py-8 text-center text-[12px] text-[#6E645A]">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#1C1814]">WeatherGPT</span>
            <span>•</span>
            <span>Smart India Hackathon</span>
          </div>
          <div className="flex items-center gap-4 text-[12px]">
            <span className="text-[#8E9197] inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Powered by Open-Meteo Weather API
            </span>
            <button
              type="button"
              onClick={() => setCurrentTab('safety')}
              className="text-[#B45309] hover:underline font-semibold"
            >
              Civil Defense Guidelines
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
