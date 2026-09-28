import axios from 'axios';
import { API_URL, API_CONFIG } from '../config/api';

const apiClient = axios.create({
  baseURL: API_URL,
  ...API_CONFIG,
});

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// Request interceptor (for adding auth tokens, etc.)
apiClient.interceptors.request.use(
  (config) => {
    // Add authentication token if available
    // const token = await getAuthToken();
    // if (token) {
    //   config.headers.Authorization = `Bearer ${token}`;
    // }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

const api = {
  // Health check
  healthCheck: async () => {
    try {
      const response = await apiClient.get('/health');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get data
  getData: async () => {
    try {
      const response = await apiClient.get('/data');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Create data
  createData: async (data) => {
    try {
      const response = await apiClient.post('/data', data);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Add more API methods as needed
};

export default api;
