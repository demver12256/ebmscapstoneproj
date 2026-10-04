// This PC's current Wi-Fi IPv4 address. For a physical Android device, keep it
// on the same Wi-Fi network as this computer. Android emulator users can use
// http://10.0.2.2:5000/api instead.
export const API_URL = 'http://192.168.8.36:5000/api';

// Public OAuth web client ID; keep this in sync with backend GOOGLE_CLIENT_ID.
export const GOOGLE_WEB_CLIENT_ID = '651314695916-jq88jrdn7vq6881n0hovugl5q3mf2djh.apps.googleusercontent.com';

export const API_CONFIG = {
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
};
