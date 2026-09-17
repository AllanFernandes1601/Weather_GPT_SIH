export interface WeatherNotificationOptions {
  title: string;
  body: string;
  tag?: string;
  data?: Record<string, unknown>;
}

export function isBrowserNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getBrowserNotificationPermission(): NotificationPermission | 'unsupported' {
  return isBrowserNotificationSupported() ? Notification.permission : 'unsupported';
}

export async function requestBrowserNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!isBrowserNotificationSupported()) {
    return 'unsupported';
  }

  return Notification.requestPermission();
}

export function showWeatherNotification({
  title,
  body,
  tag,
  data
}: WeatherNotificationOptions): Notification | null {
  if (!isBrowserNotificationSupported() || Notification.permission !== 'granted') {
    return null;
  }

  const notification = new Notification(title, { body, tag, data });
  notification.onclick = () => {
    window.focus();
    notification.close();
  };
  return notification;
}
