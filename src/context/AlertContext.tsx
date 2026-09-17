import React, { createContext, useContext, useState, useMemo, useCallback, useEffect } from 'react';
import { realtimeAlertService, SseConnectionStatus } from '../services/realtimeAlertService';
import { showWeatherNotification, getBrowserNotificationPermission } from '../services/browserNotificationService';
import { formatAlertType, formatSeverity } from '../utils/alertLabels';
import { WeatherAlertToastData } from '../components/WeatherAlertToast';

export interface AlertLocationObject {
  name?: string;
  latitude: number;
  longitude: number;
}

export interface RealtimeAlertItem {
  id: string;
  alertType: string;
  severity: string;
  title: string;
  message: string;
  location: string | AlertLocationObject;
  startTime?: string;
  endTime?: string;
  source: string;
  detectedAt: string;
  read: boolean;
  mode: 'live' | 'demo';
}

export interface AlertContextType {
  alerts: RealtimeAlertItem[];
  unreadCount: number;
  selectedAlertId: string | null;
  sseStatus: SseConnectionStatus;
  activeToast: WeatherAlertToastData | null;
  addAlert: (alert: Omit<RealtimeAlertItem, 'read'> & { read?: boolean }) => void;
  markAlertAsRead: (id: string) => void;
  markAllAsRead: () => void;
  selectAlert: (id: string | null) => void;
  clearAlerts: () => void;
  dismissToast: () => void;
  simulateNotification: (locationName?: string) => void;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

const MAX_ALERTS_SESSION = 20;

export const AlertProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [alerts, setAlerts] = useState<RealtimeAlertItem[]>([]);
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const [sseStatus, setSseStatus] = useState<SseConnectionStatus>(realtimeAlertService.getStatus());
  const [activeToast, setActiveToast] = useState<WeatherAlertToastData | null>(null);

  const dismissToast = useCallback(() => {
    setActiveToast(null);
  }, []);

  const addAlert = useCallback((incoming: Omit<RealtimeAlertItem, 'read'> & { read?: boolean }) => {
    const newAlert: RealtimeAlertItem = {
      ...incoming,
      read: incoming.read ?? false
    };

    setAlerts((prev) => {
      // Deduplicate by ID if already exists
      const filtered = prev.filter((a) => a.id !== newAlert.id);
      const updated = [newAlert, ...filtered];
      return updated.slice(0, MAX_ALERTS_SESSION);
    });

    const locationStr = formatAlertLocation(newAlert.location);

    // Show in-app toast notification ONLY for live alerts
    if (newAlert.mode === 'live') {
      setActiveToast({
        id: newAlert.id,
        location: locationStr,
        body: newAlert.message,
        alertType: newAlert.alertType,
        severity: newAlert.severity,
        mode: newAlert.mode
      });
    }

    // Native desktop / browser notification if granted
    if (getBrowserNotificationPermission() === 'granted') {
      const title = `WeatherGPT — ${formatAlertType(newAlert.alertType)} Alert`;
      const body = `${formatSeverity(newAlert.severity)} priority for ${locationStr}. ${newAlert.message}`;
      showWeatherNotification({
        title,
        body,
        tag: `weathergpt-alert-${newAlert.id}`,
        data: { alertId: newAlert.id, alertType: newAlert.alertType, severity: newAlert.severity }
      });
    }
  }, []);

  // Connect SSE at app level once
  useEffect(() => {
    const unsubscribe = realtimeAlertService.subscribe(
      (incomingAlert) => {
        addAlert(incomingAlert);
      },
      (status) => {
        setSseStatus(status);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [addAlert]);

  const markAlertAsRead = useCallback((id: string) => {
    setAlerts((prev) =>
      prev.map((alert) => (alert.id === id ? { ...alert, read: true } : alert))
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setAlerts((prev) => prev.map((alert) => ({ ...alert, read: true })));
  }, []);

  const selectAlert = useCallback((id: string | null) => {
    setSelectedAlertId(id);
  }, []);

  const clearAlerts = useCallback(() => {
    setAlerts([]);
    setSelectedAlertId(null);
  }, []);

  const simulateNotification = useCallback((locationName?: string) => {
    const loc = locationName || 'Bengaluru Central';
    const simId = `sim_alert_${Date.now()}`;
    const simAlert: RealtimeAlertItem = {
      id: simId,
      alertType: 'heavy_rain',
      severity: 'high',
      title: 'Heavy Rain Alert',
      message: 'Heavy rainfall conditions may cause waterlogging in low-lying areas.',
      location: loc,
      startTime: new Date().toISOString(),
      endTime: new Date(Date.now() + 3 * 3600 * 1000).toISOString(),
      source: 'WeatherGPT Simulation',
      detectedAt: new Date().toISOString(),
      read: false,
      mode: 'demo'
    };

    setAlerts((prev) => {
      const filtered = prev.filter((a) => a.id !== simAlert.id);
      const updated = [simAlert, ...filtered];
      return updated.slice(0, MAX_ALERTS_SESSION);
    });

    const locationStr = formatAlertLocation(simAlert.location);

    // Simulated alerts do NOT trigger the floating top toast (live alerts only)

    // Native desktop / browser notification ONLY if permission is already granted
    if (getBrowserNotificationPermission() === 'granted') {
      showWeatherNotification({
        title: 'WeatherGPT — Heavy Rain Alert',
        body: `HIGH priority for ${locationStr}. This is a simulated notification.`,
        tag: `weathergpt-sim-${simAlert.id}`,
        data: { alertId: simAlert.id, alertType: simAlert.alertType, severity: simAlert.severity, simulated: true }
      });
    }
  }, []);

  const unreadCount = useMemo(() => {
    return alerts.filter((a) => !a.read).length;
  }, [alerts]);

  const value = useMemo(
    () => ({
      alerts,
      unreadCount,
      selectedAlertId,
      sseStatus,
      activeToast,
      addAlert,
      markAlertAsRead,
      markAllAsRead,
      selectAlert,
      clearAlerts,
      dismissToast,
      simulateNotification
    }),
    [
      alerts,
      unreadCount,
      selectedAlertId,
      sseStatus,
      activeToast,
      addAlert,
      markAlertAsRead,
      markAllAsRead,
      selectAlert,
      clearAlerts,
      dismissToast,
      simulateNotification
    ]
  );

  return <AlertContext.Provider value={value}>{children}</AlertContext.Provider>;
};

export function useAlerts(): AlertContextType {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlerts must be used within an AlertProvider');
  }
  return context;
}

/**
 * Formats an alert location field into a clean, human-readable string.
 */
export function formatAlertLocation(location: string | AlertLocationObject): string {
  if (typeof location === 'string') {
    return location;
  }
  if (!location) {
    return 'Observed Station';
  }
  if (location.name && location.latitude !== undefined && location.longitude !== undefined) {
    return `${location.name} (${location.latitude.toFixed(2)}°, ${location.longitude.toFixed(2)}°)`;
  }
  if (location.name) {
    return location.name;
  }
  if (location.latitude !== undefined && location.longitude !== undefined) {
    return `${location.latitude.toFixed(2)}°, ${location.longitude.toFixed(2)}°`;
  }
  return 'Observed Station';
}
