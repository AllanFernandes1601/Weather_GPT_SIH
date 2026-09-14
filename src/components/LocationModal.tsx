import React, { useState } from 'react';
import { LocationData } from '../types';
import { LOCATIONS } from '../data/mockWeatherData';

interface LocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeLocation: LocationData;
  onSelectLocation: (loc: LocationData) => void;
}

export const LocationModal: React.FC<LocationModalProps> = ({
  isOpen,
  onClose,
  activeLocation,
  onSelectLocation
}) => {
  const [search, setSearch] = useState('');

  if (!isOpen) return null;

  const filtered = LOCATIONS.filter(
    (loc) =>
      loc.name.toLowerCase().includes(search.toLowerCase()) ||
      loc.state.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-lg bg-[#FFFDF9] rounded-3xl border border-[#E5DCCF] shadow-2xl p-6 relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-4 border-b border-[#E5DCCF]">
          <div>
            <h3 className="text-[18px] font-bold text-[#1C1814]">
              Select Indian Meteorological Station
            </h3>
            <p className="text-[12px] text-[#6E645A]">
              Switch active hyper-local telemetry &amp; Doppler observations
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-[#F2EBE1] text-[#6E645A] hover:text-[#1C1814] transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Search input */}
        <div className="my-4 relative">
          <span className="material-symbols-outlined text-[#B45309] text-[20px] absolute left-3.5 top-3">
            search
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by city (e.g. Bengaluru, Mumbai, Delhi)..."
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-[#F5F0E8] border border-[#E5DCCF] text-[14px] text-[#1C1814] placeholder:text-[#6E645A] focus:outline-none focus:ring-2 focus:ring-[#B45309]/30 focus:border-[#B45309]"
            autoFocus
          />
        </div>

        {/* City list */}
        <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
          {filtered.map((loc) => {
            const isSelected = loc.id === activeLocation.id;
            return (
              <div
                key={loc.id}
                onClick={() => {
                  onSelectLocation(loc);
                  onClose();
                }}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                  isSelected
                    ? 'bg-amber-50/90 border-[#B45309] ring-2 ring-amber-500/20'
                    : 'bg-white hover:bg-[#F5F0E8] border-[#E5DCCF]/80'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    isSelected ? 'bg-[#D97706] text-white' : 'bg-[#F2EBE1] text-[#6E645A]'
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
                        <span className="text-[10px] uppercase font-bold bg-[#D97706] text-white px-2 py-0.2 rounded-full">
                          Active
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-[#6E645A]">
                      {loc.condition} • {loc.coordinates}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[18px] font-bold text-[#1C1814]">
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

        <div className="mt-4 pt-3 border-t border-[#E5DCCF] flex items-center justify-between text-[11px] text-[#8E9197]">
          <span>Indian station datasets (Demo mode)</span>
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
