import axios from 'axios';
import { API_URL, API_CONFIG } from '../config/api';

const apiClient = axios.create({
  baseURL: API_URL,
  ...API_CONFIG,
});

const setAuthToken = (token) => {
  if (token) {
    apiClient.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete apiClient.defaults.headers.common.Authorization;
  }
};

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    return Promise.reject(error);
  }
);

apiClient.interceptors.request.use(
  (config) => {
    const token = apiClient.defaults.headers.common.Authorization;
    if (token && !config.headers.Authorization) {
      config.headers.Authorization = token;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

const api = {
  setAuthToken,
  clearAuthToken: () => setAuthToken(null),

  healthCheck: async () => {
    try {
      const response = await apiClient.get('/health');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  login: async ({ identifier, password, email, username }) => {
    try {
      const response = await apiClient.post('/auth/login', {
        identifier: identifier || username || email,
        password,
      });
      const payload = response.data;
      if (payload?.token) {
        setAuthToken(payload.token);
      }
      return payload;
    } catch (error) {
      throw error;
    }
  },

  getData: async () => {
    try {
      const response = await apiClient.get('/data');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  createData: async (data) => {
    try {
      const response = await apiClient.post('/data', data);
      return response.data;
    } catch (error) {
      throw error;
    }
  },
};

export const authApi = {
  login: (credentials) => apiClient.post('/auth/login', credentials),
  registerBeneficiary: (data) => apiClient.post('/auth/register-beneficiary', data),
  sendOtp: (data) => apiClient.post('/auth/send-otp', data),
  verifyOtp: (data) => apiClient.post('/auth/verify-otp', data),
  sendForgotPasswordOtp: (data) => apiClient.post('/auth/forgot-password/send-otp', data),
  resetPassword: (data) => apiClient.post('/auth/forgot-password/reset', data),
};

export const beneficiaryApi = {
  list: () => apiClient.get('/beneficiaries'),
  getById: (id) => apiClient.get(`/beneficiaries/${id}`),
  getMe: () => apiClient.get('/beneficiaries/me'),
  getAttendance: (id) => apiClient.get(`/beneficiaries/${id}/attendance`),
  getDistributions: (id) => apiClient.get(`/beneficiaries/${id}/distributions`),
  getEnrollments: (id) => apiClient.get(`/beneficiaries/${id}/enrollments`),
  updateMyPayoutAccount: (data) => apiClient.put('/beneficiaries/me/payout-account', data),
  addExtraPayoutAccount: (data) => apiClient.post('/beneficiaries/me/extra-payout-accounts', data),
  removeExtraPayoutAccount: (index) => apiClient.delete(`/beneficiaries/me/extra-payout-accounts/${index}`),
};

export const barangayApi = {
  list: () => apiClient.get('/barangays'),
  publicList: () => apiClient.get('/barangays/public'),
};


export const distributionApi = {
  acknowledgePayout: (transactionId) => apiClient.post(`/distributions/transactions/${transactionId}/acknowledge`),
};

export const medicalAssistanceApi = {
  getMyApplications: () => apiClient.get('/medical-assistance/my-applications'),
};

export const assistanceRequestApi = {
  list: () => apiClient.get('/assistance-requests'),
  create: (data) => apiClient.post('/assistance-requests', data),
};

export const messageApi = {
  contacts: () => apiClient.get('/messages/contacts'),
  conversations: (params) => apiClient.get('/messages/conversations', { params }),
  getMessages: (partnerId, params) => apiClient.get(`/messages/${partnerId}`, { params }),
  send: (data) => apiClient.post('/messages', data),
  unreadCount: () => apiClient.get('/messages/unread/count'),
};

export const notificationApi = {
  list: () => apiClient.get('/notifications'),
  unreadCount: () => apiClient.get('/notifications/unread-count'),
  markAsRead: (id) => apiClient.patch(`/notifications/${id}/read`),
  markAllAsRead: () => apiClient.patch('/notifications/mark-all-read'),
};

export const announcementApi = {
  list: (params) => apiClient.get('/announcements', { params }),
  myAttendance: () => apiClient.get('/announcements/my-attendance'),
  markAsRead: (id) => apiClient.patch(`/announcements/${id}/read`),
};

export default api;
