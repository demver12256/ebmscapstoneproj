// Use 10.0.2.2 for Android Emulator to connect to PC backend (port 5000)
// For physical devices, use your PC's Wi-Fi IP address (e.g., http://192.168.1.X:5000/api)
export const API_URL = 'http://10.0.2.2:5000/api';

export const API_CONFIG = {
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
};
