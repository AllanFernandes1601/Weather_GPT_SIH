import React, { useState, useRef, useEffect } from 'react';
import { NavTab, LocationData } from '../types';
import { useAlerts, formatAlertLocation } from '../context/AlertContext';
import { formatAlertType, formatSeverity } from '../utils/alertLabels';

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
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { alerts, unreadCount, markAlertAsRead, markAllAsRead, selectAlert, simulateNotification } = useAlerts();

  // Close dropdown on outside click or Escape
  useEffect(() => {
    if (!showNotifications) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowNotifications(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showNotifications]);

  const formatTimeString = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return iso;
    }
  };

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
            {unreadCount > 0 && (
              <span className="h-2 w-2 rounded-full bg-[#EA580C] animate-pulse"></span>
            )}
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

          {/* Notifications Trigger & Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setShowNotifications((prev) => !prev)}
              className="relative p-2 rounded-full bg-[#F5F0E8] hover:bg-[#E8DEC8] text-[#6E645A] hover:text-[#1C1814] active:scale-95 transition-all border border-[#E5DCCF]/60 shadow-sm cursor-pointer"
              title={unreadCount > 0 ? `${unreadCount} Unread Weather Notifications` : 'Weather Notifications'}
              aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : 'Notifications'}
              aria-expanded={showNotifications}
              aria-haspopup="true"
              id="nav-notifications-btn"
            >
              <span className="material-symbols-outlined text-[20px]">notifications</span>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#EA580C] text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white shadow-sm animate-pulse">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Notifications Popover Dropdown (360-400px desktop, responsive on mobile) */}
            {showNotifications && (
              <div 
                className="absolute right-0 mt-2 w-[calc(100vw-2rem)] sm:w-[380px] max-w-[400px] rounded-2xl bg-[#FFFDF9] border border-[#E5DCCF] shadow-xl p-4 z-50 text-left animate-in fade-in duration-150"
                id="notifications-popover"
                role="region"
                aria-label="Notifications preview"
              >
                {/* Header */}
                <div className="flex items-center justify-between pb-2.5 border-b border-[#E5DCCF]">
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] font-bold text-[#1C1814]">Notifications</span>
                    {unreadCount > 0 && (
                      <span className="text-[11px] font-semibold text-[#B45309] bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                        {unreadCount} unread
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={() => markAllAsRead()}
                      className="text-[11px] font-semibold text-[#B45309] hover:text-[#92400E] hover:underline cursor-pointer transition-colors"
                      id="notifications-mark-all-read"
                    >
                      Mark all as read
                    </button>
                  )}
                </div>

                {/* Previews List (top 3-5 alerts) */}
                <div className="mt-2.5 space-y-2 max-h-[320px] overflow-y-auto">
                  {alerts.length === 0 ? (
                    <div className="py-6 px-4 text-center space-y-1.5" id="notifications-empty-state">
                      <div className="w-9 h-9 rounded-full bg-amber-50 text-[#B45309] mx-auto flex items-center justify-center border border-amber-200/80 mb-2">
                        <span className="material-symbols-outlined text-[20px]">notifications_none</span>
                      </div>
                      <p className="text-[13px] font-bold text-[#1C1814]">No new weather alerts</p>
                      <p className="text-[11px] text-[#6E645A] leading-relaxed">
                        High-priority Open-Meteo alerts will appear here.
                      </p>
                    </div>
                  ) : (
                    alerts.slice(0, 4).map((alert) => (
                      <div
                        key={alert.id}
                        onClick={() => {
                          markAlertAsRead(alert.id);
                          selectAlert(alert.id);
                          setShowNotifications(false);
                          onSelectTab('alerts');
                        }}
                        className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                          alert.read
                            ? 'bg-[#FAF8F5]/60 hover:bg-[#F5F0E8] border-[#E5DCCF]/70 text-[#6E645A]'
                            : 'bg-amber-50/70 hover:bg-amber-100/70 border-amber-200/90 text-[#1C1814]'
                        }`}
                        id={`notification-preview-${alert.id}`}
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full border ${
                                alert.severity === 'severe'
                                  ? 'text-red-700 bg-red-50 border-red-200'
                                  : alert.severity === 'high'
                                  ? 'text-orange-700 bg-orange-50 border-orange-200'
                                  : 'text-amber-800 bg-amber-50 border-amber-200'
                              }`}
                            >
                              {formatSeverity(alert.severity)}
                            </span>
                            <span className="text-[12px] font-bold text-[#1C1814] truncate">
                              {formatAlertType(alert.alertType)} Alert
                            </span>
                            {alert.mode === 'demo' && (
                              <span className="text-[8px] font-bold uppercase text-[#B45309] bg-amber-100 px-1 rounded border border-amber-300">
                                SIMULATED
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-[#8E9197] shrink-0">
                            {formatTimeString(alert.detectedAt)}
                          </span>
                        </div>

                        <div className="text-[11px] font-semibold text-[#B45309] mt-1 truncate">
                          {formatAlertLocation(alert.location)}
                        </div>

                        <p className="text-[11px] text-[#6E645A] line-clamp-2 mt-0.5 leading-snug">
                          {alert.message}
                        </p>
                      </div>
                    ))
                  )}
                </div>

                {/* Footer: Actions */}
                <div className="mt-3 pt-2 border-t border-[#E5DCCF]/60 space-y-1.5">
                  <button
                    type="button"
                    onClick={() => simulateNotification(activeLocation.name)}
                    className="w-full py-1.5 px-3 text-center text-[12px] font-semibold text-[#6E645A] hover:text-[#1C1814] hover:bg-[#F5F0E8] rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer border border-dashed border-[#E5DCCF]"
                    id="notifications-simulate-btn"
                  >
                    <span className="material-symbols-outlined text-[16px] text-[#B45309]">notifications_active</span>
                    <span>Simulate Notification</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowNotifications(false);
                      onSelectTab('alerts');
                    }}
                    className="w-full py-2 px-3 text-center text-[12px] font-bold text-[#B45309] hover:text-[#92400E] bg-amber-50/70 hover:bg-amber-100/80 rounded-xl transition-colors flex items-center justify-center gap-1 cursor-pointer active:scale-95"
                    id="notifications-view-all-btn"
                  >
                    <span>View all alerts</span>
                    <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* User Profile Navigation Trigger */}
          <button
            type="button"
            onClick={() => onSelectTab('profile')}
            className={`w-8 h-8 rounded-full flex items-center justify-center cursor-pointer transition-all text-white shadow-sm active:scale-95 ${
              currentTab === 'profile'
                ? 'bg-[#D97706] ring-2 ring-amber-500 ring-offset-2 ring-offset-[#FAF8F5]'
                : 'bg-[#B45309] hover:ring-2 hover:ring-amber-500/40 hover:scale-105'
            }`}
            title="Profile & Preferences"
            id="nav-user-profile"
            aria-label="Open Profile and Preferences"
          >
            <span className="material-symbols-outlined text-[18px]">person</span>
          </button>
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
          {unreadCount > 0 && (
            <span className="h-1.5 w-1.5 rounded-full bg-[#EA580C] animate-pulse"></span>
          )}
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
