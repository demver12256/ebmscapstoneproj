const browserHost = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
const browserProtocol = typeof window !== 'undefined' ? window.location.protocol : 'http:';
const browserPort = typeof window !== 'undefined' ? window.location.port : '3000';

// When running in a browser through dev server (port 3000), use '/api' to eliminate
// cross-origin restrictions, preflight failures, and port 5000 firewall blocks on mobile devices.
export const API_URL = (typeof window !== 'undefined' && browserPort === '3000')
  ? '/api'
  : (process.env.REACT_APP_API_URL || `${browserProtocol}//${browserHost}:5000/api`);

export const API_BASE_URL = API_URL;

export const API_ORIGIN = (typeof window !== 'undefined' && browserPort === '3000')
  ? `${browserProtocol}//${browserHost}:${browserPort}`
  : (API_URL.startsWith('http') ? API_URL.replace(/\/api\/?$/, '') : `${browserProtocol}//${browserHost}:5000`);

export const API_CONFIG = {
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
};
