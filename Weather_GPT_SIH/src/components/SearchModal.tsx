import React, { useState, useEffect } from 'react';
import { LocationData, RemoteLocationResult } from '../types';
import { LOCATIONS } from '../data/mockWeatherData';
import { weatherService } from '../services/weatherService';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectLocation: (loc: LocationData) => void;
  onSelectRemoteLocation?: (remote: RemoteLocationResult) => void;
  onOpenAlertModal: () => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  onClose,
  onSelectLocation,
  onSelectRemoteLocation,
  onOpenAlertModal
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [remoteResults, setRemoteResults] = useState<RemoteLocationResult[]>([]);
  const [isSearchingRemote, setIsSearchingRemote] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
      setRemoteResults([]);
      setIsSearchingRemote(false);
    }
  }, [isOpen]);

  useEffect(() => {
    const trimmed = searchTerm.trim();
    if (!trimmed || trimmed.length < 2) {
      setRemoteResults([]);
      setIsSearchingRemote(false);
      return;
    }

    setIsSearchingRemote(true);
    const timer = setTimeout(async () => {
      try {
        const results = await weatherService.searchLocationsRemote(trimmed);
        setRemoteResults(results);
      } catch (err) {
        console.warn('[SearchModal Geocode Warning]:', err);
      } finally {
        setIsSearchingRemote(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) {
          onClose();
        }
      } else if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredLocations = LOCATIONS.filter(
    (l) =>
      l.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.state.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.condition.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div 
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-xl bg-[#FFFDF9] rounded-3xl border border-[#E5DCCF] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search header */}
        <div className="p-4 border-b border-[#E5DCCF] flex items-center gap-3">
          <span className="material-symbols-outlined text-[#B45309] text-[24px]">
            search
          </span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search cities, radar stations, advisories..."
            className="flex-1 bg-transparent text-[16px] text-[#1C1814] placeholder:text-[#6E645A] focus:outline-none"
            autoFocus
          />
          <button
            type="button"
            onClick={onClose}
            className="px-2 py-1 rounded-lg bg-[#F2EBE1] text-[#6E645A] hover:text-[#1C1814] text-[11px] font-mono"
          >
            ESC
          </button>
        </div>

        {/* Quick Results */}
        <div className="p-4 max-h-[380px] overflow-y-auto space-y-4">
          {/* Active Advisories Hit */}
          <div>
            <span className="text-[11px] uppercase tracking-wider font-bold text-[#6E645A] px-2 block mb-2">
              Active Severe Weather Advisories
            </span>
            <div
              onClick={() => {
                onClose();
                onOpenAlertModal();
              }}
              className="p-3 rounded-2xl bg-amber-50 border border-amber-200 hover:bg-amber-100/70 transition-colors cursor-pointer flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-xl bg-amber-200/60 text-[#C2410C] flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px]">warning</span>
                </span>
                <div>
                  <h4 className="text-[13px] font-bold text-[#1C1814]">
                    Moderate Rain Advisory — BLR/24/08
                  </h4>
                  <p className="text-[11px] text-[#6E645A]">
                    Outer Ring Road, Bellandur, Whitefield convective burst
                  </p>
                </div>
              </div>
              <span className="text-[11px] text-[#B45309] font-bold">
                View Alert →
              </span>
            </div>
          </div>

          {/* Meteorological Stations Hit */}
          {filteredLocations.length > 0 && (
            <div>
              <span className="text-[11px] uppercase tracking-wider font-bold text-[#6E645A] px-2 block mb-2">
                Indian Meteorological Stations ({filteredLocations.length})
              </span>
              <div className="space-y-1.5">
                {filteredLocations.map((loc) => (
                  <div
                    key={loc.id}
                    onClick={() => {
                      onSelectLocation(loc);
                      onClose();
                    }}
                    className="p-3 rounded-xl hover:bg-[#F5F0E8] transition-colors cursor-pointer flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="material-symbols-outlined text-[#B45309] text-[18px]">
                        location_on
                      </span>
                      <span className="text-[13px] font-semibold text-[#1C1814]">
                        {loc.name}, {loc.state}
                      </span>
                      <span className="text-[11px] text-[#6E645A] bg-[#F2EBE1] px-2 py-0.5 rounded-full">
                        {loc.condition}
                      </span>
                    </div>
                    <span className="text-[13px] font-bold text-[#1C1814]">
                      {loc.temperature}°C
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Dynamic Geocoded Locations */}
          {remoteResults.length > 0 && (
            <div>
              <div className="flex items-center justify-between px-2 mb-2">
                <span className="text-[11px] uppercase tracking-wider font-bold text-[#6E645A]">
                  Geocoded Locations ({remoteResults.length})
                </span>
                <span className="text-[10px] text-[#B45309] font-bold uppercase bg-amber-100 px-2 py-0.5 rounded-full">
                  Live Open-Meteo
                </span>
              </div>
              <div className="space-y-1.5">
                {remoteResults.map((rem, idx) => (
                  <div
                    key={`search-rem-${rem.latitude}-${rem.longitude}-${idx}`}
                    onClick={() => {
                      if (onSelectRemoteLocation) {
                        onSelectRemoteLocation(rem);
                      }
                      onClose();
                    }}
                    className="p-3 rounded-xl hover:bg-[#F5F0E8] transition-colors cursor-pointer flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="material-symbols-outlined text-[#B45309] text-[18px]">
                        pin_drop
                      </span>
                      <div>
                        <span className="text-[13px] font-semibold text-[#1C1814] block">
                          {rem.displayName}
                        </span>
                        <span className="text-[11px] text-[#6E645A]">
                          {Math.abs(rem.latitude).toFixed(2)}° {rem.latitude >= 0 ? 'N' : 'S'}, {Math.abs(rem.longitude).toFixed(2)}° {rem.longitude >= 0 ? 'E' : 'W'}
                        </span>
                      </div>
                    </div>
                    <span className="text-[11px] font-semibold text-[#B45309] group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                      Query Weather →
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {isSearchingRemote && (
            <div className="p-2 text-center text-[12px] text-[#B45309] flex items-center justify-center gap-2">
              <span className="material-symbols-outlined text-[16px] animate-spin">
                progress_activity
              </span>
              <span>Searching coordinates for "{searchTerm}"...</span>
            </div>
          )}

          {searchTerm.trim().length >= 2 &&
            !isSearchingRemote &&
            filteredLocations.length === 0 &&
            remoteResults.length === 0 && (
              <div className="py-6 text-center text-[#6E645A] text-[13px]">
                No matching stations or locations found for "{searchTerm}"
              </div>
            )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-[#F5F0E8] border-t border-[#E5DCCF] flex items-center justify-between text-[11px] text-[#6E645A]">
          <span>Navigate with arrow keys or click to select</span>
          <span className="font-mono">WeatherGPT SIH search</span>
        </div>
      </div>
    </div>
  );
};
