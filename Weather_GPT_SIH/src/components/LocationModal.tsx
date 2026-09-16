import React, { useState, useEffect } from 'react';
import { LocationData, RemoteLocationResult } from '../types';
import { LOCATIONS } from '../data/mockWeatherData';
import { weatherService } from '../services/weatherService';

interface LocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeLocation: LocationData;
  onSelectLocation: (loc: LocationData) => void;
  onSelectRemoteLocation?: (remote: RemoteLocationResult) => void;
  onUseCurrentLocation: () => void;
  isLocatingUser?: boolean;
  locationError?: string | null;
  onClearLocationError?: () => void;
}

export const LocationModal: React.FC<LocationModalProps> = ({
  isOpen,
  onClose,
  activeLocation,
  onSelectLocation,
  onSelectRemoteLocation,
  onUseCurrentLocation,
  isLocatingUser = false,
  locationError = null,
  onClearLocationError
}) => {
  const [search, setSearch] = useState('');
  const [remoteResults, setRemoteResults] = useState<RemoteLocationResult[]>([]);
  const [isSearchingRemote, setIsSearchingRemote] = useState(false);
  const [remoteSearchError, setRemoteSearchError] = useState<string | null>(null);

  // Reset search state when modal is closed
  useEffect(() => {
    if (!isOpen) {
      setSearch('');
      setRemoteResults([]);
      setIsSearchingRemote(false);
      setRemoteSearchError(null);
    }
  }, [isOpen]);

  // Debounced remote geocoding search (approx 400ms)
  useEffect(() => {
    const trimmed = search.trim();
    if (!trimmed || trimmed.length < 2) {
      setRemoteResults([]);
      setIsSearchingRemote(false);
      setRemoteSearchError(null);
      return;
    }

    setIsSearchingRemote(true);
    setRemoteSearchError(null);

    const timer = setTimeout(async () => {
      try {
        const results = await weatherService.searchLocationsRemote(trimmed);
        setRemoteResults(results);
      } catch (err: any) {
        console.warn('[Remote Geocoding Search Notice]:', err);
        setRemoteSearchError('Geocoding search unavailable. Please check your network.');
      } finally {
        setIsSearchingRemote(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [search]);

  if (!isOpen) return null;

  const filteredPresets = LOCATIONS.filter(
    (loc) =>
      loc.name.toLowerCase().includes(search.toLowerCase()) ||
      loc.state.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelectRemote = (item: RemoteLocationResult) => {
    if (onSelectRemoteLocation) {
      onSelectRemoteLocation(item);
    } else {
      const coordStr = `${Math.abs(item.latitude).toFixed(2)}° ${item.latitude >= 0 ? 'N' : 'S'}, ${Math.abs(item.longitude).toFixed(2)}° ${item.longitude >= 0 ? 'E' : 'W'}`;
      const stateLabel = item.state
        ? (item.country && item.country !== item.state ? `${item.state}, ${item.country}` : item.state)
        : item.country;

      const loc: LocationData = {
        ...activeLocation,
        id: `geo-${item.latitude.toFixed(4)}-${item.longitude.toFixed(4)}`,
        name: item.name,
        state: stateLabel,
        coordinates: coordStr,
        latitude: item.latitude,
        longitude: item.longitude,
        isLive: true,
        dataSource: 'Open-Meteo'
      };
      onSelectLocation(loc);
    }
    onClose();
  };

  const hasSearch = search.trim().length >= 2;
  const noResultsFound =
    hasSearch &&
    !isSearchingRemote &&
    filteredPresets.length === 0 &&
    remoteResults.length === 0;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-lg bg-[#FFFDF9] rounded-3xl border border-[#E5DCCF] shadow-2xl p-6 relative overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
        id="location-selector-modal"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#E5DCCF]">
          <div>
            <h3 className="text-[18px] font-bold text-[#1C1814]">
              Select Location or Coordinates
            </h3>
            <p className="text-[12px] text-[#6E645A]">
              Choose a preset station or search any worldwide location via Open-Meteo
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-[#F2EBE1] text-[#6E645A] hover:text-[#1C1814] transition-colors"
            title="Close"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Use My Current Location Action Banner */}
        <div className="mt-3">
          <button
            type="button"
            onClick={onUseCurrentLocation}
            disabled={isLocatingUser}
            className={`w-full p-3.5 rounded-2xl border transition-all text-left flex items-center justify-between group cursor-pointer ${
              isLocatingUser
                ? 'bg-amber-100/80 border-amber-400/80 text-[#B45309] cursor-wait'
                : 'bg-gradient-to-r from-amber-500/10 via-amber-400/10 to-transparent border-amber-500/30 hover:border-amber-500 hover:bg-amber-500/15 text-[#1C1814]'
            }`}
            id="btn-use-current-location"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#D97706] text-white flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                <span className={`material-symbols-outlined text-[22px] ${isLocatingUser ? 'animate-spin' : ''}`}>
                  {isLocatingUser ? 'progress_activity' : 'my_location'}
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-bold text-[#1C1814] group-hover:text-[#B45309] transition-colors">
                    {isLocatingUser ? 'Detecting Your Location...' : 'Use My Current Location'}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-300/60">
                    GPS
                  </span>
                </div>
                <p className="text-[11px] text-[#6E645A] mt-0.5 leading-tight">
                  {isLocatingUser
                    ? 'Acquiring GPS coordinates & querying Open-Meteo...'
                    : 'Requests browser coordinates to display hyper-local weather conditions'}
                </p>
              </div>
            </div>
            <span className="material-symbols-outlined text-[#B45309] text-[20px] group-hover:translate-x-0.5 transition-transform">
              arrow_forward
            </span>
          </button>

          {/* Location Error Notice if any */}
          {locationError && (
            <div className="mt-2 p-2.5 rounded-xl bg-red-50 border border-red-200/80 text-red-800 text-[12px] flex items-start justify-between gap-2 animate-in fade-in">
              <div className="flex items-start gap-2">
                <span className="material-symbols-outlined text-red-600 text-[18px] shrink-0 mt-0.5">
                  info
                </span>
                <span>{locationError}</span>
              </div>
              {onClearLocationError && (
                <button
                  type="button"
                  onClick={onClearLocationError}
                  className="text-red-600 hover:text-red-800 text-[11px] font-bold underline shrink-0"
                >
                  Dismiss
                </button>
              )}
            </div>
          )}
        </div>

        {/* Search input with debounced dynamic geocoding */}
        <div className="my-3 relative">
          <span className="material-symbols-outlined text-[#B45309] text-[20px] absolute left-3.5 top-3">
            search
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search any place (e.g. Bengaluru, Mumbai, Chennai)..."
            className="w-full pl-10 pr-10 py-2.5 rounded-2xl bg-[#F5F0E8] border border-[#E5DCCF] text-[13px] text-[#1C1814] placeholder:text-[#6E645A] focus:outline-none focus:ring-2 focus:ring-[#B45309]/30 focus:border-[#B45309]"
            id="location-search-input"
          />
          {isSearchingRemote ? (
            <span className="material-symbols-outlined text-[#B45309] text-[18px] absolute right-3.5 top-3 animate-spin">
              progress_activity
            </span>
          ) : search ? (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="material-symbols-outlined text-[#8E9197] hover:text-[#1C1814] text-[18px] absolute right-3.5 top-3"
            >
              cancel
            </button>
          ) : null}
        </div>

        {/* City & Geocoded Results List */}
        <div className="space-y-3 overflow-y-auto pr-1 flex-1 min-h-[180px]" id="location-results-container">
          {/* Loading indicator banner */}
          {isSearchingRemote && (
            <div className="p-3 rounded-2xl bg-amber-50/70 border border-amber-200/60 flex items-center justify-center gap-2 text-[#B45309] text-[12px] animate-pulse">
              <span className="material-symbols-outlined text-[18px] animate-spin">
                progress_activity
              </span>
              <span>Searching Open-Meteo coordinates for "{search}"...</span>
            </div>
          )}

          {/* Remote Search Error Banner */}
          {remoteSearchError && (
            <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[#B45309] text-[12px] flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] shrink-0">
                info
              </span>
              <span>{remoteSearchError}</span>
            </div>
          )}

          {/* Preset stations matching query */}
          {filteredPresets.length > 0 && (
            <div className="space-y-1.5">
              {hasSearch && (
                <span className="text-[11px] uppercase tracking-wider font-bold text-[#6E645A] px-1 block">
                  Preset Stations ({filteredPresets.length})
                </span>
              )}
              {filteredPresets.map((loc) => {
                const isSelected = loc.id === activeLocation.id;
                return (
                  <div
                    key={loc.id}
                    onClick={() => {
                      onSelectLocation(loc);
                      onClose();
                    }}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between group ${
                      isSelected
                        ? 'bg-amber-50/90 border-[#B45309] ring-2 ring-amber-500/20 shadow-sm'
                        : 'bg-white hover:bg-[#F5F0E8] border-[#E5DCCF]/80'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        isSelected ? 'bg-[#D97706] text-white' : 'bg-[#F2EBE1] text-[#6E645A] group-hover:scale-105 transition-transform'
                      }`}>
                        <span className="material-symbols-outlined text-[20px]">location_on</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[14px] font-bold text-[#1C1814]">
                            {loc.name}
                          </span>
                          <span className="text-[12px] text-[#6E645A]">
                            ({loc.state})
                          </span>
                          {isSelected && (
                            <span className="text-[10px] uppercase font-bold bg-[#D97706] text-white px-2 py-0.5 rounded-full">
                              Active
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-[#6E645A]">
                          {loc.coordinates} • {loc.condition}
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[16px] font-bold text-[#1C1814]">
                        {loc.temperature}°C
                      </span>
                      <span className="block text-[11px] text-[#6E645A]">
                        Feels {loc.feelsLike}°
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Dynamic Open-Meteo Geocoded Results */}
          {remoteResults.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] uppercase tracking-wider font-bold text-[#6E645A]">
                  Geocoded Locations ({remoteResults.length})
                </span>
                <span className="text-[10px] text-[#B45309] font-bold uppercase tracking-wider bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300/60">
                  Open-Meteo API
                </span>
              </div>
              {remoteResults.map((rem, idx) => {
                const isSelected =
                  activeLocation.name.toLowerCase() === rem.name.toLowerCase() ||
                  (activeLocation.latitude !== undefined &&
                    Math.abs(activeLocation.latitude - rem.latitude) < 0.01 &&
                    activeLocation.longitude !== undefined &&
                    Math.abs(activeLocation.longitude - rem.longitude) < 0.01);

                const subtitleParts: string[] = [];
                if (rem.state) subtitleParts.push(rem.state);
                if (rem.country && rem.country !== rem.state) subtitleParts.push(rem.country);
                const subtitle = subtitleParts.join(', ');
                const coordStr = `${Math.abs(rem.latitude).toFixed(2)}° ${rem.latitude >= 0 ? 'N' : 'S'}, ${Math.abs(rem.longitude).toFixed(2)}° ${rem.longitude >= 0 ? 'E' : 'W'}`;

                return (
                  <div
                    key={`remote-${rem.latitude}-${rem.longitude}-${idx}`}
                    onClick={() => handleSelectRemote(rem)}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between group ${
                      isSelected
                        ? 'bg-amber-50/90 border-[#B45309] ring-2 ring-amber-500/20 shadow-sm'
                        : 'bg-white hover:bg-[#F5F0E8] border-[#E5DCCF]/80'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          isSelected ? 'bg-[#D97706] text-white' : 'bg-[#F2EBE1] text-[#B45309] group-hover:scale-105 transition-transform'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[20px]">pin_drop</span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[14px] font-bold text-[#1C1814] truncate">
                            {rem.name}
                          </span>
                          {subtitle && (
                            <span className="text-[12px] text-[#6E645A] truncate">
                              ({subtitle})
                            </span>
                          )}
                          {isSelected && (
                            <span className="text-[10px] uppercase font-bold bg-[#D97706] text-white px-2 py-0.5 rounded-full">
                              Active
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-[#6E645A] block mt-0.5">
                          {coordStr}
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0 pl-3">
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#B45309] bg-amber-50 border border-amber-200/80 px-2.5 py-1 rounded-full group-hover:bg-[#B45309] group-hover:text-white transition-colors">
                        <span>Query</span>
                        <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* No locations found empty state */}
          {noResultsFound && (
            <div className="py-8 text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-[#F2EBE1] text-[#6E645A] flex items-center justify-center mx-auto">
                <span className="material-symbols-outlined text-[24px]">location_off</span>
              </div>
              <p className="text-[14px] font-semibold text-[#1C1814]">
                No locations found for "{search}"
              </p>
              <p className="text-[12px] text-[#6E645A] max-w-xs mx-auto">
                Check the spelling or try searching for another city, town, or district.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-3 pt-3 border-t border-[#E5DCCF] flex items-center justify-between text-[11px] text-[#8E9197]">
          <span>Synced with Open-Meteo Geocoding & Weather Services</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-full bg-[#F2EBE1] hover:bg-[#E8DEC8] text-[#1C1814] font-semibold text-[12px] transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
