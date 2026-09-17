const configuredApiUrl = (import.meta.env.VITE_API_URL || '').trim().replace(/\/$/, '');

export const apiBaseUrl = configuredApiUrl;

export function apiUrl(path: string): string {
  if (!configuredApiUrl) return path;
  return `${configuredApiUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

export function websocketUrl(path: string): string {
  if (!configuredApiUrl) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}${path}`;
  }

  const url = new URL(apiUrl(path));
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.toString();
}

async function readResponseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') || '';
  const body = await response.text();
  if (!body) return null;

  if (contentType.toLowerCase().includes('application/json')) {
    try {
      return JSON.parse(body);
    } catch {
      throw new Error(`Backend returned invalid JSON (HTTP ${response.status}).`);
    }
  }

  const preview = body.replace(/\s+/g, ' ').trim().slice(0, 160);
  throw new Error(
    `Backend returned ${contentType || 'a non-JSON response'} (HTTP ${response.status}).${preview ? ` Response: ${preview}` : ''}`
  );
}

export async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(path), init);
  const payload = await readResponseBody(response);
  if (!response.ok) {
    const message = payload && typeof payload === 'object' && 'error' in payload
      ? String((payload as { error?: unknown }).error || '')
      : `Backend request failed (HTTP ${response.status}).`;
    throw new Error(message);
  }
  return payload as T;
}