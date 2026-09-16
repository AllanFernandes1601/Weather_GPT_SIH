import React, { useState } from 'react';
import { NavTab, LocationData } from '../types';

interface NavbarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  activeLocation: LocationData;
  onOpenLocationModal: () => void;
  onOpenSearchModal: () => void;
  onOpenAlertModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  activeLocation,
  onOpenLocationModal,
  onOpenSearchModal,
  onOpenAlertModal
}) => {
  const [showNotifications, setShowNotifications] = useState(false);

  return (
    <header className="fixed top-0 inset-x-0 z-50 bg-[#FFFDF9]/95 backdrop-blur-xl border-b border-[#E5DCCF]/60 shadow-[0_1px_12px_rgba(46,40,35,0.04)] transition-all">
      <div className="h-20 max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
        {/* Brand Logo & Name */}
        <div 
          onClick={() => onSelectTab('home')}
          className="flex items-center gap-3 shrink-0 cursor-pointer group"
          id="navbar-brand"
        >
          <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-[#B45309] text-white shadow-md shadow-amber-500/20 group-hover:scale-105 transition-transform">
            <span className="material-symbols-outlined text-[22px]">cloud</span>
            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-amber-300 border-2 border-white animate-pulse"></span>
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-[19px] tracking-tight leading-none text-[#1C1814] group-hover:text-[#B45309] transition-colors">
              WeatherGPT
            </span>
            <span className="text-[10px] tracking-widest uppercase text-[#B45309] font-bold mt-1">
              AI Weather Intelligence
            </span>
          </div>
        </div>

        {/* Desktop Navigation links */}
        <nav className="hidden lg:flex items-center gap-1 bg-[#F5F0E8]/90 p-1.5 rounded-full border border-[#E5DCCF]/60 shadow-[0_1px_4px_rgba(46,40,35,0.04)]" id="nav-desktop-tabs">
          <button
            type="button"
            onClick={() => onSelectTab('home')}
            className={`px-4 py-1.5 rounded-full text-[13px] font-semibold transition-all duration-200 ${
              currentTab === 'home'
                ? 'bg-[#D97706] text-white shadow-[0_2px_8px_rgba(217,119,6,0.25)]'
                : 'text-[#6E645A] hover:bg-[#E8DEC8] hover:text-[#1C1814]'
            }`}
          >
            Home
          </button>
          <button
            type="button"
            onClick={() => onSelectTab('forecast')}
            className={`px-4 py-1.5 rounded-full text-[13px] font-semibold transition-all duration-200 ${
              currentTab === 'forecast'
                ? 'bg-[#D97706] text-white shadow-[0_2px_8px_rgba(217,119,6,0.25)]'
                : 'text-[#6E645A] hover:bg-[#E8DEC8] hover:text-[#1C1814]'
            }`}
          >
            Forecast
          </button>
          <button
            type="button"
            onClick={() => onSelectTab('alerts')}
            className={`relative px-4 py-1.5 rounded-full text-[13px] font-semibold transition-all duration-200 flex items-center gap-1.5 ${
              currentTab === 'alerts'
                ? 'bg-[#D97706] text-white shadow-[0_2px_8px_rgba(217,119,6,0.25)]'
                : 'text-[#6E645A] hover:bg-[#E8DEC8] hover:text-[#1C1814]'
            }`}
          >
            <span>Alerts</span>
            <span className="h-2 w-2 rounded-full bg-[#EA580C] animate-pulse"></span>
          </button>
          <button
            type="button"
            onClick={() => onSelectTab('weather-map')}
            className={`px-4 py-1.5 rounded-full text-[13px] font-semibold transition-all duration-200 ${
              currentTab === 'weather-map'
                ? 'bg-[#D97706] text-white shadow-[0_2px_8px_rgba(217,119,6,0.25)]'
                : 'text-[#6E645A] hover:bg-[#E8DEC8] hover:text-[#1C1814]'
            }`}
          >
            Weather Map
          </button>
          <button
            type="button"
            onClick={() => onSelectTab('safety')}
            className={`px-4 py-1.5 rounded-full text-[13px] font-semibold transition-all duration-200 ${
              currentTab === 'safety'
                ? 'bg-[#D97706] text-white shadow-[0_2px_8px_rgba(217,119,6,0.25)]'
                : 'text-[#6E645A] hover:bg-[#E8DEC8] hover:text-[#1C1814]'
            }`}
          >
            Safety
          </button>
        </nav>

        {/* Right Action Icons: Location, Search, Notifications, Profile */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Location Selector Trigger */}
          <button
            type="button"
            onClick={onOpenLocationModal}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#F5F0E8] hover:bg-[#E8DEC8] text-[#1C1814] border border-[#E5DCCF]/60 transition-all cursor-pointer shadow-sm hover:shadow active:scale-95"
            title="Change Location"
            id="nav-location-btn"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600"></span>
            </span>
            <span className="text-[12px] sm:text-[13px] font-semibold truncate max-w-[130px] sm:max-w-[160px]">
              {activeLocation.name}, {activeLocation.state}
            </span>
            <span className="text-[11px] text-[#6E645A] bg-[#EFE7DB] px-1.5 py-0.5 rounded-full font-medium">
              {activeLocation.temperature}°C
            </span>
            <span className="material-symbols-outlined text-[#8E9197] text-[16px]">expand_more</span>
          </button>

          {/* Quick Search Trigger (⌘K) */}
          <button
            type="button"
            onClick={onOpenSearchModal}
            className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-full bg-[#F5F0E8] hover:bg-[#E8DEC8] text-[#6E645A] hover:text-[#1C1814] active:scale-95 transition-all border border-[#E5DCCF]/60 shadow-sm"
            title="Search locations & advisories (⌘K)"
            id="nav-search-btn"
          >
            <span className="material-symbols-outlined text-[18px]">search</span>
            <span className="hidden sm:inline text-[11px] bg-[#E2D5BE] px-1.5 py-0.5 rounded font-mono text-[#6E645A]">
              ⌘K
            </span>
          </button>

          {/* Notifications Trigger */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 rounded-full bg-[#F5F0E8] hover:bg-[#E8DEC8] text-[#6E645A] hover:text-[#1C1814] active:scale-95 transition-all border border-[#E5DCCF]/60 shadow-sm"
              title="Active Weather Notifications"
              id="nav-notifications-btn"
            >
              <span className="material-symbols-outlined text-[20px]">notifications</span>
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-[#EA580C] ring-2 ring-white animate-pulse"></span>
            </button>

            {/* Notifications Popover Dropdown */}
            {showNotifications && (
              <div 
                className="absolute right-0 mt-2 w-80 sm:w-88 rounded-2xl bg-[#FFFDF9] border border-[#E5DCCF] shadow-xl p-4 z-50 text-left"
                id="notifications-popover"
              >
                <div className="flex items-center justify-between pb-2 border-b border-[#E5DCCF]">
                  <span className="text-[13px] font-bold text-[#1C1814]">Live Advisories</span>
                  <span className="text-[11px] text-[#B45309] font-semibold bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                    1 Active Alert
                  </span>
                </div>
                <div 
                  onClick={() => {
                    setShowNotifications(false);
                    onOpenAlertModal();
                  }}
                  className="mt-3 p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 hover:bg-amber-100/70 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-1.5 text-[#C2410C] font-semibold text-[12px]">
                    <span className="material-symbols-outlined text-[16px]">warning</span>
                    <span>Moderate Rain Advisory</span>
                  </div>
                  <p className="text-[12px] text-[#1C1814] mt-1 font-medium leading-snug">
                    Heavy rain & waterlogging expected in Eastern & Southern sectors (3:30 - 8:00 PM).
                  </p>
                  <span className="text-[11px] text-[#B45309] font-bold mt-2 inline-block">
                    View Route Precautions →
                  </span>
                </div>
                <div className="mt-3 text-center">
                  <span className="text-[11px] text-[#8E9197]">
                    Demo weather notification feed
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* User Profile */}
          <div
            className="w-8 h-8 rounded-full bg-[#B45309] flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-amber-500/40 hover:scale-105 transition-all text-white shadow-sm"
            title="Researcher / Commuter Profile (SIH-2024 Demo)"
            id="nav-user-profile"
          >
            <span className="material-symbols-outlined text-[18px]">person</span>
          </div>
        </div>
      </div>

      {/* Mobile Nav Tabs Bar */}
      <div className="lg:hidden flex items-center justify-around border-t border-[#E5DCCF]/50 px-3 py-2 bg-[#FAF8F5]/95">
        <button
          type="button"
          onClick={() => onSelectTab('home')}
          className={`px-3 py-1 rounded-full text-[12px] font-semibold ${
            currentTab === 'home' ? 'bg-[#D97706] text-white' : 'text-[#6E645A]'
          }`}
        >
          Home
        </button>
        <button
          type="button"
          onClick={() => onSelectTab('forecast')}
          className={`px-3 py-1 rounded-full text-[12px] font-semibold ${
            currentTab === 'forecast' ? 'bg-[#D97706] text-white' : 'text-[#6E645A]'
          }`}
        >
          Forecast
        </button>
        <button
          type="button"
          onClick={() => onSelectTab('alerts')}
          className={`px-3 py-1 rounded-full text-[12px] font-semibold flex items-center gap-1 ${
            currentTab === 'alerts' ? 'bg-[#D97706] text-white' : 'text-[#6E645A]'
          }`}
        >
          <span>Alerts</span>
          <span className="h-1.5 w-1.5 rounded-full bg-[#EA580C]"></span>
        </button>
        <button
          type="button"
          onClick={() => onSelectTab('weather-map')}
          className={`px-3 py-1 rounded-full text-[12px] font-semibold ${
            currentTab === 'weather-map' ? 'bg-[#D97706] text-white' : 'text-[#6E645A]'
          }`}
        >
          Map
        </button>
        <button
          type="button"
          onClick={() => onSelectTab('safety')}
          className={`px-3 py-1 rounded-full text-[12px] font-semibold ${
            currentTab === 'safety' ? 'bg-[#D97706] text-white' : 'text-[#6E645A]'
          }`}
        >
          Safety
        </button>
      </div>
    </header>
  );
};
