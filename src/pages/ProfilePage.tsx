import React, { useCallback, useState } from 'react';
import { LocationData } from '../types';
import { SmsAlertSubscription } from '../components/SmsAlertSubscription';
import { WeatherAlertToast, WeatherAlertToastData } from '../components/WeatherAlertToast';
import { formatAlertType, formatSeverity } from '../utils/alertLabels';
import {
  getBrowserNotificationPermission,
  isBrowserNotificationSupported,
  requestBrowserNotificationPermission,
  showWeatherNotification
} from '../services/browserNotificationService';

interface ProfilePageProps {
  location: LocationData;
  onBackToHome: () => void;
  onOpenLocationModal: () => void;
}

interface DemoInboxEntry {
  id: number;
  timestamp: string;
  severity: 'high';
  alertType: 'heavy_rain';
  location: string;
  message: string;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({
  location,
  onBackToHome,
  onOpenLocationModal
}) => {
  // Notification preference toggles (Section 2)
  const [browserNotifications, setBrowserNotifications] = useState(false);
  const [smsAlertsEnabled, setSmsAlertsEnabled] = useState(true);
  const [highPriorityOnly, setHighPriorityOnly] = useState(true);
  const [notificationError, setNotificationError] = useState<string | null>(null);
  const [demoInbox, setDemoInbox] = useState<DemoInboxEntry[]>([]);
  const [demoToast, setDemoToast] = useState<WeatherAlertToastData | null>(null);
  const browserNotificationsSupported = isBrowserNotificationSupported();

  const dismissDemoToast = useCallback(() => setDemoToast(null), []);

  const handleBrowserNotificationsToggle = async () => {
    if (browserNotifications) {
      setBrowserNotifications(false);
      return;
    }

    if (!isBrowserNotificationSupported()) {
      setBrowserNotifications(false);
      setNotificationError('This browser does not support browser notifications.');
      return;
    }

    const permission = await requestBrowserNotificationPermission();
    if (permission === 'granted') {
      setNotificationError(null);
      setBrowserNotifications(true);
    } else if (permission === 'denied') {
      setBrowserNotifications(false);
      setNotificationError('Browser notifications are blocked. Enable them in your browser settings.');
    } else {
      setBrowserNotifications(false);
      setNotificationError('Browser notification permission was not granted.');
    }
  };

  const handleSimulateSevereWeather = () => {
    const locationName = location.name || 'Bengaluru';
    const message = `High-priority heavy rain risk for ${locationName}. Avoid flood-prone underpasses.`;
    const entry: DemoInboxEntry = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      severity: 'high',
      alertType: 'heavy_rain',
      location: locationName,
      message
    };

    setDemoInbox((previous) => [entry, ...previous]);
    setDemoToast({
      id: entry.id,
      location: locationName,
      body: 'Heavy rainfall expected. Avoid flood-prone underpasses.'
    });

    if (getBrowserNotificationPermission() === 'granted') {
      showWeatherNotification({
        title: `WeatherGPT — ${formatAlertType(entry.alertType)} Alert`,
        body: `${formatSeverity(entry.severity)} priority for ${locationName}. Heavy rainfall expected. Avoid flood-prone underpasses.`,
        tag: 'weathergpt-heavy-rain-demo',
        data: { type: entry.alertType, severity: entry.severity, location: entry.location }
      });
    }
  };

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-200 pb-12" id="profile-page-container">
      {/* HEADER BANNER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-6 lg:p-8 rounded-3xl bg-gradient-to-br from-[#FFFDF9] via-[#FAF6EE] to-[#F5ECE0] border border-[#E5DCCF]/80 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-[#B45309] text-white flex items-center justify-center shadow-md shadow-amber-500/15 shrink-0">
            <span className="material-symbols-outlined text-[28px]">account_circle</span>
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[22px] sm:text-[26px] font-bold text-[#1C1814] tracking-tight">
                Profile &amp; Preferences
              </h1>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#B45309] bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-200">
                User Settings
              </span>
            </div>
            <p className="text-[13px] sm:text-[14px] text-[#6E645A] mt-1 leading-relaxed">
              Manage your primary location, notification channels, and emergency alert subscriptions.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onBackToHome}
          className="self-start sm:self-auto px-5 py-2.5 rounded-full bg-white hover:bg-[#F5F0E8] text-[#1C1814] border border-[#E5DCCF] font-semibold text-[13px] shadow-sm transition-all flex items-center gap-2 cursor-pointer active:scale-95 shrink-0"
          id="profile-back-home-btn"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          <span>Back to Live Home</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.85fr)] items-start gap-6">
        {/* SECTION 1: WEATHER ALERT DELIVERY (SMS SUBSCRIPTION) */}
        <div className="space-y-3 min-w-0" id="profile-section-sms-delivery">
        <div className="px-2">
          <h2 className="text-[18px] sm:text-[20px] font-bold text-[#1C1814]">
            Weather Alert Delivery
          </h2>
          <p className="text-[13px] text-[#6E645A]">
            Location-aware emergency SMS alerts evaluated deterministically by WeatherGPT.
          </p>
        </div>
        <SmsAlertSubscription
          activeLocation={location}
          onOpenLocationModal={onOpenLocationModal}
        />

          <WeatherAlertToast alert={demoToast} onDismiss={dismissDemoToast} />
        </div>

        <div className="min-w-0 space-y-6">
          {/* SECTION 2: NOTIFICATION PREFERENCES */}
          <div
            className="rounded-3xl bg-[#FFFDF9] p-4 sm:p-6 shadow-sm border border-[#E5DCCF]/80 space-y-6"
            id="profile-section-notifications"
          >
        <div className="border-b border-[#E5DCCF]/60 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-[#B45309] border border-amber-200/80 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[20px]">notifications_active</span>
            </div>
            <div>
              <h2 className="text-[18px] font-bold text-[#1C1814]">Notification Preferences</h2>
              <p className="text-[13px] text-[#6E645A]">
                Select your active delivery channels and threshold filters.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {/* Toggle 1: Browser Notifications */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-[#FAF8F5] border border-[#E5DCCF]/70 hover:border-[#D97706]/40 transition-colors">
            <div className="space-y-1 pr-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-[#6E645A]">web</span>
                <span id="browser-notifications-label" className="text-[14px] font-bold text-[#1C1814]">Browser Notifications</span>
                <span className="text-[10px] font-semibold text-[#8E9197] bg-[#E8DEC8]/80 px-2 py-0.5 rounded-full">
                  Preview
                </span>
              </div>
              <p className="text-[12px] text-[#6E645A] leading-relaxed">
                Receive WeatherGPT alerts as desktop notifications while the app is open.
              </p>
              {!browserNotificationsSupported && (
                <p className="text-[12px] text-red-700 leading-relaxed">
                  This browser does not support browser notifications.
                </p>
              )}
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={browserNotifications}
              aria-labelledby="browser-notifications-label"
              disabled={!browserNotificationsSupported}
              onClick={handleBrowserNotificationsToggle}
              className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-amber-500/40 ${
                browserNotifications ? 'bg-[#D97706]' : 'bg-[#D4C8B8]'
              } ${browserNotificationsSupported ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}
              id="toggle-browser-notifications"
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  browserNotifications ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {notificationError && (
            <p className="px-4 text-[12px] text-red-700" role="alert">
              {notificationError}
            </p>
          )}

          {/* Toggle 2: SMS Alerts */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-[#FAF8F5] border border-[#E5DCCF]/70 hover:border-[#D97706]/40 transition-colors">
            <div className="space-y-1 pr-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-[#B45309]">sms</span>
                <span id="sms-alerts-label" className="text-[14px] font-bold text-[#1C1814]">SMS Emergency Alerts</span>
                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  Active Channel
                </span>
              </div>
              <p className="text-[12px] text-[#6E645A] leading-relaxed">
                Receive direct telecom dispatches to your verified mobile number for severe weather warnings.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={smsAlertsEnabled}
              onClick={() => setSmsAlertsEnabled((prev) => !prev)}
              aria-labelledby="sms-alerts-label"
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-amber-500/40 ${
                smsAlertsEnabled ? 'bg-[#D97706]' : 'bg-[#D4C8B8]'
              }`}
              id="toggle-sms-alerts"
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  smsAlertsEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Toggle 3: High Priority Alerts Only */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-[#FAF8F5] border border-[#E5DCCF]/70 hover:border-[#D97706]/40 transition-colors">
            <div className="space-y-1 pr-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-[#EA580C]">priority_high</span>
                <span id="high-priority-label" className="text-[14px] font-bold text-[#1C1814]">High Priority Alerts Only</span>
              </div>
              <p className="text-[12px] text-[#6E645A] leading-relaxed">
                Filter out advisory notices to minimize fatigue; only dispatch alerts for HIGH and SEVERE conditions.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={highPriorityOnly}
              onClick={() => setHighPriorityOnly((prev) => !prev)}
              aria-labelledby="high-priority-label"
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-amber-500/40 ${
                highPriorityOnly ? 'bg-[#D97706]' : 'bg-[#D4C8B8]'
              }`}
              id="toggle-high-priority-only"
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  highPriorityOnly ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

          {/* DEMO NOTIFICATIONS */}
          <div className="border-t border-[#E5DCCF]/60 pt-6 space-y-4" id="profile-section-demo-notifications">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-[16px] font-bold text-[#1C1814]">Demo Mode</h3>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[#B45309] bg-amber-100 px-2 py-0.5 rounded-full border border-amber-200">
                    Local simulation
                  </span>
                </div>
                <p className="text-[12px] text-[#6E645A] mt-1 leading-relaxed">
                  Demo notifications are generated locally. Real carrier SMS delivery requires the configured production SMS provider.
                </p>
                <p className="text-[12px] text-[#6E645A] mt-1 leading-relaxed">
                  Current demo notifications require WeatherGPT to be open. Background push support can be added using a service worker.
                </p>
              </div>
              <button
                type="button"
                onClick={handleSimulateSevereWeather}
                className="shrink-0 px-4 py-2.5 rounded-full bg-amber-100 hover:bg-amber-200 text-[#92400E] border border-amber-300 text-[13px] font-bold transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                id="simulate-severe-weather-btn"
              >
                <span className="material-symbols-outlined text-[18px]">thunderstorm</span>
                <span>Simulate Severe Weather Alert</span>
              </button>
            </div>

            <div className="space-y-3" id="demo-sms-inbox">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-[16px] font-bold text-[#1C1814]">Demo SMS Inbox</h3>
                  <p className="text-[12px] text-[#6E645A]">Simulated SMS — Demo Mode</p>
                </div>
                <span className="text-[11px] text-[#8E9197]">{demoInbox.length} message{demoInbox.length === 1 ? '' : 's'}</span>
              </div>

              {demoInbox.length === 0 ? (
                <p className="p-4 rounded-2xl bg-[#FAF8F5] border border-dashed border-[#E5DCCF] text-[13px] text-[#8E9197]">
                  Simulated alerts will appear here.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {demoInbox.map((entry) => (
                    <article key={entry.id} className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#E5DCCF]/70">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[13px] font-bold text-[#1C1814]">
                            <span className="inline-flex items-center gap-2">
                              <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold tracking-wider text-red-700 border border-red-200">
                                {formatSeverity(entry.severity)}
                              </span>
                              <span>{formatAlertType(entry.alertType)}</span>
                            </span>
                          </p>
                          <p className="text-[12px] text-[#6E645A] mt-0.5">{entry.location}</p>
                        </div>
                        <time className="text-[11px] text-[#8E9197]" dateTime={entry.timestamp}>Just now</time>
                      </div>
                      <p className="text-[12px] text-[#6E645A] mt-3 leading-relaxed">
                        [WeatherGPT] {entry.message}
                      </p>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* SECTION 3: CURRENT LOCATION */}
        <div
          className="rounded-3xl bg-[#FFFDF9] p-4 sm:p-6 shadow-sm border border-[#E5DCCF]/80 space-y-6"
          id="profile-section-location"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E5DCCF]/60 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-[#B45309] border border-amber-200/80 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[20px]">location_on</span>
              </div>
              <div>
                <h2 className="text-[18px] font-bold text-[#1C1814]">Current Location</h2>
                <p className="text-[13px] text-[#6E645A]">
                  Telemetry forecasts and alert radii are synchronized to this station.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onOpenLocationModal}
              className="px-4 py-2 rounded-full bg-[#F5F0E8] hover:bg-[#E8DEC8] text-[#1C1814] border border-[#E5DCCF] text-[13px] font-semibold transition-all flex items-center gap-2 cursor-pointer shadow-sm active:scale-95 shrink-0"
              id="profile-change-location-btn"
            >
              <span className="material-symbols-outlined text-[17px] text-[#B45309]">edit_location_alt</span>
              <span>Change Location</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Station Name */}
            <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#E5DCCF]/70">
              <span className="text-[11px] uppercase tracking-wider font-bold text-[#6E645A]">
                Station Name
              </span>
              <p className="text-[16px] font-bold text-[#1C1814] mt-1 truncate">
                {location.name || 'Bengaluru Central'}
              </p>
              <span className="text-[12px] text-[#B45309] font-medium">
                {location.state || 'Karnataka'}
              </span>
            </div>

            {/* Coordinates */}
            <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#E5DCCF]/70">
              <span className="text-[11px] uppercase tracking-wider font-bold text-[#6E645A]">
                Coordinates
              </span>
              <p className="text-[14px] font-mono font-semibold text-[#1C1814] mt-1">
                {location.latitude !== undefined && location.longitude !== undefined
                  ? `${location.latitude.toFixed(4)}°, ${location.longitude.toFixed(4)}°`
                  : location.coordinates || '12.97° N, 77.59° E'}
              </p>
              <span className="text-[12px] text-[#6E645A]">WGS84 Reference</span>
            </div>

            {/* Current Temperature */}
            <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#E5DCCF]/70">
              <span className="text-[11px] uppercase tracking-wider font-bold text-[#6E645A]">
                Current Temperature
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-[20px] font-bold text-[#1C1814]">
                  {location.temperature}°C
                </span>
                <span className="text-[12px] text-[#6E645A] capitalize">
                  {location.condition}
                </span>
              </div>
            </div>

            {/* Telemetry Status */}
            <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#E5DCCF]/70 flex flex-col justify-between">
              <span className="text-[11px] uppercase tracking-wider font-bold text-[#6E645A]">
                Data Stream
              </span>
              <div className="flex items-center gap-2 mt-1">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <span className="text-[13px] font-semibold text-emerald-800">
                  {location.isLive ? 'Live Station Active' : 'Open-Meteo Synced'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
};
