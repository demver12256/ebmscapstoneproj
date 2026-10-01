// The phone and this PC are on the same Wi-Fi network (192.168.8.x).
// 10.0.2.2 only works from an Android emulator, not from a physical phone.
export const API_URL = 'http://192.168.8.35:5000/api';

export const API_CONFIG = {
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
};
