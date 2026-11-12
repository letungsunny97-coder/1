/**
 * API configuration for Seraph Video Downloader
 * Supports automatic switching between relative path (Web) and Cloud host (Android APK)
 */

export const DEFAULT_CLOUD_HOST = '';
const STORAGE_KEY = 'seraph_api_server_host_v1';

export function getServerHost(): string {
  if (typeof window === 'undefined') return '';

  // If in web browser over HTTP(S) and not in Android file:/// or appassets scheme:
  const isWeb = window.location.protocol.startsWith('http') && !window.location.host.includes('appassets.androidplatform.net');
  if (isWeb) {
    return '';
  }

  // If running in Android APK: check localStorage for custom server host
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && saved.trim()) {
      return saved.trim().replace(/\/+$/, '');
    }
  } catch {}

  return DEFAULT_CLOUD_HOST;
}

export function setServerHost(host: string): void {
  try {
    if (!host || !host.trim()) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, host.trim().replace(/\/+$/, ''));
    }
  } catch {}
}

export function getApiEndpoint(endpoint: string): string {
  const host = getServerHost();
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  if (!host) {
    if (typeof window !== 'undefined' && window.location.protocol.startsWith('http')) {
      return cleanEndpoint;
    }
    return '';
  }
  return `${host}${cleanEndpoint}`;
}
