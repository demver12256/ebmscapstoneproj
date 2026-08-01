// Frontend API configuration shared with mobile-like setup
// Update this path or set REACT_APP_API_URL in frontend/.env for production/local overrides
export const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

export const API_CONFIG = {
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
};
