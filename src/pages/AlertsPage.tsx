import React, { useState, useEffect } from 'react';
import { LocationData } from '../types';
import { useAlerts, formatAlertLocation } from '../context/AlertContext';
import { formatAlertType, formatSeverity } from '../utils/alertLabels';
import { getAlertGuidance, SAFETY_DISCLAIMER } from '../utils/alertGuidance';
import {
  isBrowserNotificationSupported,
  getBrowserNotificationPermission,
  requestBrowserNotificationPermission
} from '../services/browserNotificationService';

interface AlertsPageProps {
  location: LocationData;
  onBackToHome: () => void;
  onOpenLocationModal: () => void;
  onRefreshWeather?: () => void;
}

export const AlertsPage: React.FC<AlertsPageProps> = ({
  location,
  onBackToHome,
  onOpenLocationModal,
  onRefreshWeather
}) => {
  const { alerts, selectedAlertId, sseStatus, markAlertAsRead, selectAlert, simulateNotification } = useAlerts();
  const [notificationPermission, setNotificationPermission] = useState<'default' | 'granted' | 'denied'>('default');
  const [notificationNotice, setNotificationNotice] = useState<string | null>(null);

  useEffect(() => {
    if (isBrowserNotificationSupported()) {
      setNotificationPermission(getBrowserNotificationPermission());
    }
  }, []);

  const handleToggleNotifications = async () => {
    if (!isBrowserNotificationSupported()) {
      setNotificationNotice('Browser notifications are not supported in this browser.');
      return;
    }

    const permission = await requestBrowserNotificationPermission();
    setNotificationPermission(permission);

    if (permission === 'granted') {
      setNotificationNotice(null);
    } else if (permission === 'denied') {
      setNotificationNotice('Notifications are blocked in your browser settings.');
    }
  };

  const formatTimeString = (iso: string) => {
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return iso;
    }
  };

  const hasWeatherTelemetry = location && typeof location.temperature === 'number' && !isNaN(location.temperature);

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-200 pb-12" id="alerts-page-container">
      {/* 1. HEADER BANNER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-6 lg:p-8 rounded-3xl bg-gradient-to-br from-[#FFFDF9] via-[#FAF6EE] to-[#F5ECE0] border border-[#E5DCCF]/80 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#EA580C] to-[#C2410C] text-white flex items-center justify-center shadow-md shadow-orange-500/15 shrink-0">
            <span className="material-symbols-outlined text-[28px]">warning</span>
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[22px] sm:text-[26px] font-bold text-[#1C1814] tracking-tight">
                Real-Time Weather Alerts
              </h1>
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                Live Monitoring
              </span>
            </div>
            <p className="text-[13px] sm:text-[14px] text-[#6E645A] mt-1 leading-relaxed">
              WeatherGPT monitors Open-Meteo data and alerts you when high-priority weather conditions are detected.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onBackToHome}
          className="self-start sm:self-auto px-5 py-2.5 rounded-full bg-white hover:bg-[#F5F0E8] text-[#1C1814] border border-[#E5DCCF] font-semibold text-[13px] shadow-sm transition-all flex items-center gap-2 cursor-pointer active:scale-95 shrink-0"
          id="alerts-back-home-btn"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          <span>Back to Live Home</span>
        </button>
      </div>

      {/* 2. OPERATIONAL STATUS & LIVE SSE DATA STRIP */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Source & Detection Status */}
        <div className="p-4 rounded-2xl bg-[#FFFDF9] border border-[#E5DCCF]/80 shadow-sm">
          <span className="text-[11px] uppercase tracking-wider font-bold text-[#6E645A]">
            Telemetry Engine
          </span>
          <div className="flex items-center gap-2 mt-1">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <p className="text-[14px] font-bold text-[#1C1814]">
              {location.dataSource || 'Open-Meteo Live'}
            </p>
          </div>
          <span className="text-[12px] text-[#6E645A]">HIGH &amp; SEVERE threshold guard</span>
        </div>

        {/* Monitored Station */}
        <div className="p-4 rounded-2xl bg-[#FFFDF9] border border-[#E5DCCF]/80 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-[11px] uppercase tracking-wider font-bold text-[#6E645A]">
              Active Station
            </span>
            <p className="text-[14px] font-bold text-[#1C1814] truncate mt-1">
              {location.name || 'Bengaluru Central'}
            </p>
            <span className="text-[12px] text-[#B45309] font-medium truncate block">
              {location.state || 'Karnataka'}
            </span>
          </div>
          <button
            type="button"
            onClick={onOpenLocationModal}
            className="text-[11px] font-semibold text-[#B45309] hover:underline text-left mt-2 cursor-pointer"
          >
            Change station →
          </button>
        </div>

        {/* Real-time SSE Stream Status */}
        <div className="p-4 rounded-2xl bg-[#FFFDF9] border border-[#E5DCCF]/80 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-[11px] uppercase tracking-wider font-bold text-[#6E645A]">
              Live Stream Status
            </span>
            <div className="flex items-center gap-2 mt-1">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  sseStatus === 'connected'
                    ? 'bg-emerald-500'
                    : sseStatus === 'connecting'
                    ? 'bg-amber-500 animate-pulse'
                    : 'bg-gray-400'
                }`}
              />
              <p className="text-[14px] font-bold text-[#1C1814]">
                {sseStatus === 'connected'
                  ? 'Connected'
                  : sseStatus === 'connecting'
                  ? 'Reconnecting to live alerts'
                  : 'Disconnected'}
              </p>
            </div>
            <span className="text-[12px] text-[#6E645A]">GET /api/alerts/stream</span>
          </div>
          <span className="text-[11px] text-[#8E9197] mt-2">Zero poll SSE pipeline</span>
        </div>

        {/* Browser Notification Status & Action */}
        <div className="p-4 rounded-2xl bg-[#FFFDF9] border border-[#E5DCCF]/80 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-[11px] uppercase tracking-wider font-bold text-[#6E645A]">
              Browser Alerts
            </span>
            <p className="text-[14px] font-bold text-[#1C1814] mt-1 capitalize">
              {notificationPermission === 'granted' ? 'Enabled' : notificationPermission === 'denied' ? 'Blocked' : 'Off'}
            </p>
            {notificationNotice ? (
              <p className="text-[11px] text-red-600 mt-0.5">{notificationNotice}</p>
            ) : (
              <span className="text-[12px] text-[#6E645A]">
                {notificationPermission === 'granted' ? 'Desktop popups active' : 'Click to enable alerts'}
              </span>
            )}
          </div>
          {notificationPermission !== 'granted' && (
            <button
              type="button"
              onClick={handleToggleNotifications}
              className="mt-2 px-3 py-1.5 rounded-full bg-amber-100 hover:bg-amber-200 text-[#92400E] border border-amber-300 text-[11px] font-bold transition-all text-center cursor-pointer active:scale-95"
            >
              Enable Browser Alerts
            </button>
          )}
        </div>
      </div>

      {/* 3. CURRENT WEATHER CONDITIONS SECTION (PART 3 & 4) */}
      <section className="p-5 sm:p-6 rounded-3xl bg-[#FFFDF9] border border-[#E5DCCF]/80 shadow-sm space-y-4" id="alerts-current-conditions">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#E5DCCF]/60">
          <div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#B45309] text-[20px]">thermostat</span>
              <h2 className="text-[16px] sm:text-[18px] font-bold text-[#1C1814]">
                Current Weather Conditions
              </h2>
            </div>
            <p className="text-[12px] text-[#6E645A]">
              Live meteorological telemetry for {location.name}, {location.state}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-[#8E9197]">
              Source: <span className="text-[#1C1814] font-bold">{location.dataSource || 'Open-Meteo'}</span>
            </span>
            {onRefreshWeather && (
              <button
                type="button"
                onClick={onRefreshWeather}
                className="p-1 text-[#6E645A] hover:text-[#1C1814] hover:bg-[#F5F0E8] rounded-full transition-colors"
                title="Refresh current weather data"
                aria-label="Refresh current weather data"
              >
                <span className="material-symbols-outlined text-[18px]">refresh</span>
              </button>
            )}
          </div>
        </div>

        {!hasWeatherTelemetry ? (
          <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200 text-center">
            <p className="text-[13px] font-semibold text-[#92400E]">
              Current weather data temporarily unavailable.
            </p>
            <p className="text-[12px] text-[#78350F] mt-0.5">
              Displaying station identification. Live meteorological readings will populate when data refreshes.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Temperature */}
            {typeof location.temperature === 'number' && (
              <div className="p-3 rounded-2xl bg-[#FAF8F5] border border-[#E5DCCF]/70 text-left">
                <span className="text-[10px] uppercase font-bold text-[#6E645A] tracking-wider">Temperature</span>
                <p className="text-[18px] font-bold text-[#1C1814] mt-0.5">{location.temperature}°C</p>
                {typeof location.feelsLike === 'number' && (
                  <span className="text-[11px] text-[#8E9197]">Feels like {location.feelsLike}°C</span>
                )}
              </div>
            )}

            {/* Weather Condition */}
            {location.condition && (
              <div className="p-3 rounded-2xl bg-[#FAF8F5] border border-[#E5DCCF]/70 text-left">
                <span className="text-[10px] uppercase font-bold text-[#6E645A] tracking-wider">Condition</span>
                <p className="text-[14px] font-bold text-[#1C1814] mt-1 truncate">{location.condition}</p>
                <span className="text-[11px] text-[#B45309] font-medium">Observed sky</span>
              </div>
            )}

            {/* Humidity */}
            {typeof location.humidity === 'number' && (
              <div className="p-3 rounded-2xl bg-[#FAF8F5] border border-[#E5DCCF]/70 text-left">
                <span className="text-[10px] uppercase font-bold text-[#6E645A] tracking-wider">Humidity</span>
                <p className="text-[18px] font-bold text-[#1C1814] mt-0.5">{location.humidity}%</p>
                <span className="text-[11px] text-[#8E9197]">{location.humidityDesc || 'Relative'}</span>
              </div>
            )}

            {/* Wind */}
            {typeof location.windSpeed === 'number' && (
              <div className="p-3 rounded-2xl bg-[#FAF8F5] border border-[#E5DCCF]/70 text-left">
                <span className="text-[10px] uppercase font-bold text-[#6E645A] tracking-wider">Wind</span>
                <p className="text-[18px] font-bold text-[#1C1814] mt-0.5">{location.windSpeed} <span className="text-[12px] font-normal">km/h</span></p>
                <span className="text-[11px] text-[#8E9197]">{location.windDirection || 'Direction'}</span>
              </div>
            )}

            {/* Precipitation / Rainfall */}
            {location.precipitation && typeof location.precipitation.dailyTotalMm === 'number' && (
              <div className="p-3 rounded-2xl bg-[#FAF8F5] border border-[#E5DCCF]/70 text-left">
                <span className="text-[10px] uppercase font-bold text-[#6E645A] tracking-wider">Rainfall</span>
                <p className="text-[18px] font-bold text-[#1C1814] mt-0.5">{location.precipitation.dailyTotalMm} <span className="text-[12px] font-normal">mm</span></p>
                <span className="text-[11px] text-[#8E9197]">24h precipitation</span>
              </div>
            )}

            {/* Visibility */}
            {typeof location.visibility === 'number' && (
              <div className="p-3 rounded-2xl bg-[#FAF8F5] border border-[#E5DCCF]/70 text-left">
                <span className="text-[10px] uppercase font-bold text-[#6E645A] tracking-wider">Visibility</span>
                <p className="text-[18px] font-bold text-[#1C1814] mt-0.5">{location.visibility} <span className="text-[12px] font-normal">km</span></p>
                <span className="text-[11px] text-[#8E9197]">Atmospheric clarity</span>
              </div>
            )}

            {/* Air Quality (if available) */}
            {location.airQuality && typeof location.airQuality.aqi === 'number' && (
              <div className="p-3 rounded-2xl bg-[#FAF8F5] border border-[#E5DCCF]/70 text-left">
                <span className="text-[10px] uppercase font-bold text-[#6E645A] tracking-wider">Air Quality</span>
                <p className="text-[18px] font-bold text-[#1C1814] mt-0.5">{location.airQuality.aqi} <span className="text-[11px] font-normal">AQI</span></p>
                <span className="text-[11px] text-[#B45309] font-semibold">{location.airQuality.status}</span>
              </div>
            )}
          </div>
        )}
      </section>

      {/* 4. MAIN AREA: ALERTS FEED (LEFT) + SIDEBAR CONTROLS (RIGHT) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start" id="alerts-main-area">
        {/* LEFT COLUMN: RECENT WEATHER ALERTS FEED (Span 2) */}
        <div className="lg:col-span-2 space-y-4" id="alerts-list-section">
          <div className="flex items-center justify-between px-1">
            <div>
              <h2 className="text-[18px] sm:text-[20px] font-bold text-[#1C1814]">
                Recent Weather Alerts
              </h2>
              <p className="text-[12px] sm:text-[13px] text-[#6E645A]">
                High &amp; severe weather conditions broadcast from Open-Meteo telemetry.
              </p>
            </div>
            <span className="text-[12px] font-semibold text-[#6E645A] bg-[#E8DEC8]/60 px-3 py-1 rounded-full">
              {alerts.length} alert{alerts.length === 1 ? '' : 's'}
            </span>
          </div>

          {/* Empty State (PART 15) */}
          {alerts.length === 0 ? (
            <div className="p-8 sm:p-12 rounded-3xl bg-[#FFFDF9] border border-dashed border-[#E5DCCF] text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-[#B45309] border border-amber-200/80 mx-auto flex items-center justify-center">
                <span className="material-symbols-outlined text-[26px]">notifications_none</span>
              </div>
              <h3 className="text-[16px] font-bold text-[#1C1814]">
                No high-priority weather alerts detected in this session.
              </h3>
              <p className="text-[13px] text-[#6E645A] max-w-md mx-auto leading-relaxed">
                WeatherGPT is monitoring Open-Meteo for high and severe weather conditions.
                Advisories will appear here automatically when risk thresholds are crossed.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {alerts.map((alert) => {
                const isSelected = selectedAlertId === alert.id;
                const guidance = getAlertGuidance(alert.alertType);

                return (
                  <article
                    key={alert.id}
                    onClick={() => {
                      markAlertAsRead(alert.id);
                      selectAlert(isSelected ? null : alert.id);
                    }}
                    className={`rounded-3xl p-5 sm:p-6 transition-all duration-200 cursor-pointer border ${
                      isSelected
                        ? 'bg-[#FFFDF9] border-[#D97706] shadow-md ring-2 ring-amber-500/20'
                        : alert.read
                        ? 'bg-[#FFFDF9] border-[#E5DCCF]/80 hover:border-[#D97706]/40 shadow-sm'
                        : 'bg-[#FFFDF9] border-amber-300 shadow-sm ring-1 ring-amber-400/30'
                    }`}
                    id={`alert-card-${alert.id}`}
                  >
                    {/* Top Badges & Meta */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#E5DCCF]/60">
                      <div className="flex items-center gap-2">
                        {/* Mode Badge (PART 11 & 16) */}
                        {alert.mode === 'live' ? (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                            <span>Live Alert</span>
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#B45309] bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300">
                            SIMULATED
                          </span>
                        )}

                        {/* Severity Chip */}
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                            alert.severity === 'severe'
                              ? 'text-red-700 bg-red-50 border-red-200'
                              : alert.severity === 'high'
                              ? 'text-orange-700 bg-orange-50 border-orange-200'
                              : 'text-amber-800 bg-amber-50 border-amber-200'
                          }`}
                        >
                          {formatSeverity(alert.severity)}
                        </span>

                        {/* Unread Indicator */}
                        {!alert.read && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#EA580C] bg-orange-50 px-2 py-0.5 rounded-full border border-orange-200">
                            Unread
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-[12px] text-[#8E9197]">
                        <time dateTime={alert.detectedAt}>Detected {formatTimeString(alert.detectedAt)}</time>
                        <span className="font-semibold text-[#6E645A]">via {alert.source}</span>
                      </div>
                    </div>

                    {/* Title & Short Description */}
                    <div className="pt-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <h3 className="text-[16px] sm:text-[18px] font-bold text-[#1C1814]">
                          {formatAlertType(alert.alertType)} Alert
                        </h3>
                        <span className="material-symbols-outlined text-[20px] text-[#8E9197] transition-transform duration-200">
                          {isSelected ? 'expand_less' : 'expand_more'}
                        </span>
                      </div>
                      <p className="text-[13px] font-semibold text-[#B45309]">
                        {formatAlertLocation(alert.location)}
                      </p>
                      <p className="text-[13px] text-[#6E645A] leading-relaxed">
                        {alert.message}
                      </p>
                    </div>

                    {/* Expanded Detail Panel (PART 6, 7, 8) */}
                    {isSelected && (
                      <div
                        className="mt-4 pt-4 border-t border-[#E5DCCF]/60 space-y-4 animate-in fade-in duration-150"
                        id={`alert-detail-${alert.id}`}
                      >
                        <h4 className="text-[12px] uppercase font-bold text-[#6E645A] tracking-wider">
                          Alert Parameters &amp; Meteorological Scope
                        </h4>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          <div className="p-3 rounded-xl bg-[#FAF8F5] border border-[#E5DCCF]/70">
                            <span className="text-[10px] uppercase tracking-wider font-bold text-[#6E645A]">
                              Severity Level
                            </span>
                            <p className="text-[13px] font-bold text-[#1C1814] mt-0.5">
                              {formatSeverity(alert.severity)}
                            </p>
                          </div>

                          <div className="p-3 rounded-xl bg-[#FAF8F5] border border-[#E5DCCF]/70">
                            <span className="text-[10px] uppercase tracking-wider font-bold text-[#6E645A]">
                              Geographic Center
                            </span>
                            <p className="text-[13px] font-bold text-[#1C1814] mt-0.5 truncate">
                              {formatAlertLocation(alert.location)}
                            </p>
                          </div>

                          <div className="p-3 rounded-xl bg-[#FAF8F5] border border-[#E5DCCF]/70">
                            <span className="text-[10px] uppercase tracking-wider font-bold text-[#6E645A]">
                              Detection Source
                            </span>
                            <p className="text-[13px] font-bold text-[#1C1814] mt-0.5">
                              {alert.source}
                            </p>
                          </div>

                          {alert.startTime && (
                            <div className="p-3 rounded-xl bg-[#FAF8F5] border border-[#E5DCCF]/70">
                              <span className="text-[10px] uppercase tracking-wider font-bold text-[#6E645A]">
                                Expected Start
                              </span>
                              <p className="text-[13px] font-bold text-[#1C1814] mt-0.5">
                                {formatTimeString(alert.startTime)}
                              </p>
                            </div>
                          )}

                          {alert.endTime && (
                            <div className="p-3 rounded-xl bg-[#FAF8F5] border border-[#E5DCCF]/70">
                              <span className="text-[10px] uppercase tracking-wider font-bold text-[#6E645A]">
                                Expected End
                              </span>
                              <p className="text-[13px] font-bold text-[#1C1814] mt-0.5">
                                {formatTimeString(alert.endTime)}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Point-wise User Instructions (PART 7) */}
                        <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200/90 space-y-2">
                          <div className="flex items-center gap-1.5 text-[#92400E] font-bold text-[13px]">
                            <span className="material-symbols-outlined text-[18px]">checklist</span>
                            <span>What You Should Do</span>
                          </div>
                          <ul className="space-y-1.5 pl-1">
                            {guidance.map((step, idx) => (
                              <li key={idx} className="text-[13px] text-[#78350F] flex items-start gap-2 leading-snug">
                                <span className="text-[#D97706] font-bold mt-0.5">•</span>
                                <span>{step}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Safety Disclaimer (PART 8) */}
                        <p className="text-[11px] text-[#8E9197] italic leading-relaxed pt-1">
                          {SAFETY_DISCLAIMER}
                        </p>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: SIDEBAR CONTROLS & MONITORING INFO (Span 1) */}
        <div className="space-y-4" id="alerts-sidebar">
          {/* Notification Settings Card */}
          <div className="p-5 rounded-3xl bg-[#FFFDF9] border border-[#E5DCCF]/80 shadow-sm space-y-3">
            <div className="flex items-center gap-2 text-[#1C1814] font-bold text-[14px]">
              <span className="material-symbols-outlined text-[20px] text-[#B45309]">notifications_active</span>
              <span>Alert Notifications</span>
            </div>
            <p className="text-[12px] text-[#6E645A] leading-relaxed">
              When high or severe weather is detected, WeatherGPT pushes real-time notifications directly to your desktop.
            </p>
            <div className="pt-2 border-t border-[#E5DCCF]/60 flex items-center justify-between">
              <span className="text-[12px] font-semibold text-[#1C1814]">Desktop Popups</span>
              <button
                type="button"
                onClick={handleToggleNotifications}
                className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
                  notificationPermission === 'granted'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-amber-100 hover:bg-amber-200 text-[#92400E] border border-amber-300'
                }`}
              >
                {notificationPermission === 'granted' ? 'Enabled ✓' : 'Enable Alerts'}
              </button>
            </div>
            <div className="pt-3 border-t border-[#E5DCCF]/60">
              <button
                type="button"
                onClick={() => simulateNotification(location.name)}
                className="w-full py-2 px-3 rounded-xl border border-dashed border-[#D97706]/60 bg-amber-50/50 hover:bg-amber-100/70 text-[#B45309] text-[12px] font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                id="alerts-simulate-notification-btn"
              >
                <span className="material-symbols-outlined text-[17px]">notifications_active</span>
                <span>Simulate Notification</span>
              </button>
            </div>
          </div>

          {/* Live Monitoring Info */}
          <div className="p-5 rounded-3xl bg-[#FFFDF9] border border-[#E5DCCF]/80 shadow-sm space-y-2">
            <h4 className="text-[12px] uppercase font-bold text-[#6E645A] tracking-wider">
              Monitoring Specifications
            </h4>
            <div className="text-[12px] space-y-1.5 text-[#6E645A]">
              <div className="flex items-center justify-between">
                <span>Filter Policy:</span>
                <span className="font-semibold text-[#1C1814]">HIGH &amp; SEVERE only</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Duplicate Guard:</span>
                <span className="font-semibold text-[#1C1814]">60m Reminder Cooldown</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Escalation Rule:</span>
                <span className="font-semibold text-[#1C1814]">Immediate on severity increase</span>
              </div>
            </div>
          </div>
        </div>
      </div>


    </div>
  );
};
