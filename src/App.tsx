import { useState, useEffect } from 'react';
import { NavTab, LocationData } from './types';
import { LOCATIONS, HOURLY_FORECAST_DATA, ACTIVE_ALERT } from './data/mockWeatherData';
import { Navbar } from './components/Navbar';
import { WeatherHero } from './components/WeatherHero';
import { AlertCard } from './components/AlertCard';
import { AIWeatherInput } from './components/AIWeatherInput';
import { HourlyForecast } from './components/HourlyForecast';
import { WeatherDetails } from './components/WeatherDetails';
import { ExploreSection } from './components/ExploreSection';
import { LocationModal } from './components/LocationModal';
import { SearchModal } from './components/SearchModal';
import { AlertModal } from './components/AlertModal';
import { PlaceholderPage } from './pages/PlaceholderPage';

export default function App() {
  const [currentTab, setCurrentTab] = useState<NavTab>('home');
  const [activeLocation, setActiveLocation] = useState<LocationData>(LOCATIONS[0]);
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);

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

  const handleToggleVoice = () => {
    setIsVoiceActive((prev) => !prev);
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
                onToggleVoice={handleToggleVoice}
                onOpenLocationModal={() => setIsLocationModalOpen(true)}
              />

              {/* Section 2: Severe Weather Alert Banner */}
              <AlertCard
                alert={ACTIVE_ALERT}
                onViewAlert={() => setIsAlertModalOpen(true)}
              />

              {/* Section 3: Ask WeatherGPT AI Hub with Voice-to-Cloud Integration */}
              <AIWeatherInput
                locationName={activeLocation.name}
                isVoiceActive={isVoiceActive}
                onToggleVoice={handleToggleVoice}
              />

              {/* Section 4: Today's Hourly Forecast */}
              <HourlyForecast forecastItems={HOURLY_FORECAST_DATA} />

              {/* Section 5: Detailed Weather Metrics Bento Grid */}
              <WeatherDetails location={activeLocation} />

              {/* Section 6: Explore & Specialized Weather Sections */}
              <ExploreSection onNavigate={(tab) => setCurrentTab(tab)} />
            </div>
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

      {/* 3. MODALS */}
      <LocationModal
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
        activeLocation={activeLocation}
        onSelectLocation={(loc) => setActiveLocation(loc)}
      />

      <SearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        onSelectLocation={(loc) => setActiveLocation(loc)}
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
            <span>Smart India Hackathon Prototype</span>
          </div>
          <div className="flex items-center gap-4 text-[12px]">
            <span className="text-[#8E9197]">Demo weather data • Sources will be connected</span>
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

