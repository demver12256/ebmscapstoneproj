import axios from 'axios';
import { API_URL, API_CONFIG } from '../config/api';

const apiClient = axios.create({
  baseURL: API_URL,
  ...API_CONFIG,
});

let authToken = null;

const setAuthToken = (token) => {
  authToken = token || null;
  if (authToken) {
    apiClient.defaults.headers.common.Authorization = authToken.startsWith('Bearer ')
      ? authToken
      : `Bearer ${authToken}`;
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
    const token = authToken || apiClient.defaults.headers.common.Authorization;
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = token.startsWith('Bearer ')
        ? token
        : `Bearer ${token}`;
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
      const token = payload?.token || payload?.data?.token;
      if (token) {
        setAuthToken(token);
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
  googleLogin: async (credential) => {
    const response = await apiClient.post('/auth/google', { credential });
    const payload = response.data;
    const token = payload?.token || payload?.data?.token;
    if (token) setAuthToken(token);
    return payload;
  },
  changePassword: (data) => apiClient.post('/auth/change-password', data),
  registerBeneficiary: (data) => apiClient.post('/auth/register-beneficiary', data),
  sendOtp: (data) => apiClient.post('/auth/send-otp', data),
  verifyOtp: (data) => apiClient.post('/auth/verify-otp', data),
  sendMobileOtp: (data) => apiClient.post('/auth/send-mobile-otp', data),
  verifyMobileOtp: (data) => apiClient.post('/auth/verify-mobile-otp', data),
  sendForgotPasswordOtp: (data) => apiClient.post('/auth/forgot-password/send-otp', data),
  resetPassword: (data) => apiClient.post('/auth/forgot-password/reset', data),
};

export const beneficiaryApi = {
  list: () => apiClient.get('/beneficiaries'),
  getById: (id) => apiClient.get(`/beneficiaries/${id}`),
  getMe: () => apiClient.get('/beneficiaries/me'),
  uploadProfilePicture: (data) => apiClient.post('/beneficiaries/me/profile-picture', data, {
    headers: { 'Content-Type': 'multipart/form-data' },
    transformRequest: (d) => d,
  }),
  updateMe: (data) => apiClient.put('/beneficiaries/me', data),
  updateContact: (data) => apiClient.put('/beneficiaries/me/contact', data),
  uploadMyDocument: (data) => apiClient.post('/beneficiaries/me/documents', data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  deleteMyDocument: (id) => apiClient.delete(`/beneficiaries/me/documents/${id}`),
  submitMyApplication: (data) => apiClient.post('/beneficiaries/me/submit', data),
  listApplications: () => apiClient.get('/beneficiaries/applications'),
  getAttendance: (id) => apiClient.get(`/beneficiaries/${id}/attendance`),
  getDistributions: (id) => apiClient.get(`/beneficiaries/${id}/distributions`),
  getEnrollments: (id) => apiClient.get(`/beneficiaries/${id}/enrollments`),
  updateMyPayoutAccount: (data) => apiClient.put('/beneficiaries/me/payout-account', data),
  addExtraPayoutAccount: (data) => apiClient.post('/beneficiaries/me/extra-payout-accounts', data),
  removeExtraPayoutAccount: (index) => apiClient.delete(`/beneficiaries/me/extra-payout-accounts/${index}`),
  getQrPass: (id) => apiClient.get(`/beneficiaries/${id}/qr-pass`),
  getMyQrPass: () => apiClient.get('/beneficiaries/me/qr-pass'),
  regenerateQrPass: (id) => apiClient.post(`/beneficiaries/${id}/regenerate-qr`),
};

export const dashboardApi = {
  summary: () => apiClient.get('/reports/summary'),
  monthlyDistribution: () => apiClient.get('/reports/monthly-distribution'),
  beneficiariesByProgram: () => apiClient.get('/reports/beneficiaries-by-program'),
};

export const barangayApi = {
  list: () => apiClient.get('/barangays'),
  publicList: () => apiClient.get('/barangays/public'),
};


export const programApi = {
  list: (params) => apiClient.get('/programs', { params }),
  get: (id) => apiClient.get(`/programs/${id}`),
  getEnrolledBeneficiaries: (id) => apiClient.get(`/programs/${id}/beneficiaries`),
  autoEnrollBeneficiaries: (id) => apiClient.post(`/programs/${id}/auto-enroll`),
};

export const distributionApi = {
  listEvents: (params) => apiClient.get('/distributions/events', { params }),
  getEvent: (id) => apiClient.get(`/distributions/events/${id}`),
  getTransactions: (eventId) => apiClient.get(`/distributions/events/${eventId}/transactions`),
  verifyBeneficiary: (data) => apiClient.post('/distributions/verify-beneficiary', data),
  releaseBenefit: (eventId, txnId, data) => apiClient.post(`/distributions/events/${eventId}/transactions/${txnId}/release`, data),
  acknowledgePayout: (transactionId) => apiClient.post(`/distributions/transactions/${transactionId}/acknowledge`),
  list: () => apiClient.get('/distributions'),
};

export const medicalAssistanceApi = {
  getMyApplications: () => apiClient.get('/medical-assistance/my-applications'),
};

export const assistanceRequestApi = {
  list: (params) => apiClient.get('/assistance-requests', { params }),
  create: (data) => {
    if (typeof FormData !== 'undefined' && data instanceof FormData) {
      return apiClient.post('/assistance-requests', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    }
    return apiClient.post('/assistance-requests', data);
  },
  updateStatus: (id, data) => apiClient.patch(`/assistance-requests/${id}/status`, data),
  claimWithRfid: (data) => apiClient.post('/assistance-requests/claim-rfid', data),
  stats: (params) => apiClient.get('/assistance-requests/stats', { params }),
};

export const interventionApi = {
  listMine: () => apiClient.get('/interventions/me'),
  getAll: (params) => apiClient.get('/interventions/all', { params }),
  getPending: () => apiClient.get('/interventions/pending'),
  verify: (id, data) => apiClient.post(`/interventions/${id}/verify`, data),
  reject: (id, data) => apiClient.post(`/interventions/${id}/reject`, data),
  getStats: () => apiClient.get('/interventions/stats'),
  create: (data) => apiClient.post('/interventions', data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  uploadDocument: (id, data) => apiClient.post(`/interventions/${id}/document`, data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  updateStaffIntervention: (id, data) => apiClient.put(`/interventions/${id}`, data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  submit: (data) => apiClient.post('/interventions/submit', data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  update: (id, data) => apiClient.put(`/interventions/me/${id}`, data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  remove: (id) => apiClient.delete(`/interventions/me/${id}`),
};

export const userApi = {
  list: (params) => apiClient.get('/users', { params }),
  getById: (id) => apiClient.get(`/users/${id}`),
};

export const reportsApi = {
  summary: () => apiClient.get('/reports/summary'),
  monthlyDistribution: () => apiClient.get('/reports/monthly-distribution'),
  beneficiariesByProgram: () => apiClient.get('/reports/beneficiaries-by-program'),
  distributionStatus: () => apiClient.get('/reports/distribution-status'),
  monthlyAid: () => apiClient.get('/reports/monthly-aid'),
  recentDistributions: (params) => apiClient.get('/reports/recent-distributions', { params }),
  getTableBeneficiaries: (params) => apiClient.get('/reports/table/beneficiaries', { params }),
  getTablePrograms: (params) => apiClient.get('/reports/table/programs', { params }),
  getTableEnrollments: (params) => apiClient.get('/reports/table/enrollments', { params }),
  getTableAssistanceRequests: (params) => apiClient.get('/reports/table/assistance-requests', { params }),
  getTableAttendance: (params) => apiClient.get('/reports/table/attendance', { params }),
  getTableAnnouncements: (params) => apiClient.get('/reports/table/announcements', { params }),
  getDistributionDetail: (id) => apiClient.get(`/reports/distribution/${id}`),
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
  get: (id) => apiClient.get(`/announcements/${id}`),
  scanRfid: (id, data) => apiClient.post(`/announcements/${id}/scan-rfid`, data),
  myAttendance: () => apiClient.get('/announcements/my-attendance'),
  markAsRead: (id) => apiClient.patch(`/announcements/${id}/read`),
};

export const botApi = {
  chat: (message) => apiClient.post('/bot/chat', { message }),
};

export default api;
