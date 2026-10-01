// Keep the API on the same host the browser used to open the frontend.
// This supports both localhost on the development PC and its LAN IP on phones.
const browserHost = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
const browserProtocol = typeof window !== 'undefined' ? window.location.protocol : 'http:';
const configuredApiUrl = process.env.REACT_APP_API_URL;
const configuredApiTargetsLoopback = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|::1)(:\d+)?(\/|$)/i.test(configuredApiUrl || '');
const browserUsesLoopback = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(browserHost.toLowerCase());

// A localhost override is correct on the dev PC, but points a phone back to
// itself. In that case, keep the API port and follow the browser's LAN host.
export const API_URL = configuredApiUrl && !(configuredApiTargetsLoopback && !browserUsesLoopback)
  ? configuredApiUrl
  : `${browserProtocol}//${browserHost}:5000/api`;
export const API_ORIGIN = API_URL.replace(/\/api\/?$/, '');

export const API_CONFIG = {
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
};
