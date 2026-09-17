import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

const WEATHER_CHANNEL_ID = 'weather-alerts';

export async function enableWeatherNotifications(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;

  const current = await LocalNotifications.checkPermissions();
  const permission = current.display === 'granted'
    ? current
    : await LocalNotifications.requestPermissions();

  if (permission.display !== 'granted') return false;

  if (Capacitor.getPlatform() === 'android') {
    await LocalNotifications.createChannel({
      id: WEATHER_CHANNEL_ID,
      name: 'Weather Alerts',
      description: 'WeatherGPT severe weather advisories',
      importance: 4,
      visibility: 1,
      sound: 'default'
    });
  }

  return true;
}

export async function disableWeatherNotifications(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await LocalNotifications.cancelAll();
}