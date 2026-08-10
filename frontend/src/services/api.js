import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

export const setAuthToken = (token) => {
  if (token) {
    apiClient.defaults.headers.common.Authorization = `Bearer ${token}`;
    console.log('Auth token set for API calls');
  } else {
    delete apiClient.defaults.headers.common.Authorization;
    console.log('Auth token removed');
  }
};

// Initialize token from localStorage on app start
const storedToken = localStorage.getItem('ebms_token');
if (storedToken) {
  setAuthToken(storedToken);
}

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Preserve the full error structure for better error handling
    if (error.response) {
      return Promise.reject(error);
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  login: (credentials) => apiClient.post('/auth/login', credentials),
  registerBeneficiary: (data) => apiClient.post('/auth/register-beneficiary', data),
};

export const dashboardApi = {
  summary: () => apiClient.get('/reports/summary'),
  monthlyDistribution: () => apiClient.get('/reports/monthly-distribution'),
};

export const reportsApi = {
  summary: () => apiClient.get('/reports/summary'),
  beneficiariesByProgram: () => apiClient.get('/reports/beneficiaries-by-program'),
  recentDistributions: (params) => apiClient.get('/reports/recent-distributions', { params }),
  distributionStatus: () => apiClient.get('/reports/distribution-status'),
  monthlyAid: () => apiClient.get('/reports/monthly-aid'),
  getDistributionDetail: (id) => apiClient.get(`/reports/distribution/${id}`),
  getTableBeneficiaries: (params) => apiClient.get('/reports/table/beneficiaries', { params }),
  getTablePrograms: (params) => apiClient.get('/reports/table/programs', { params }),
  getTableEnrollments: (params) => apiClient.get('/reports/table/enrollments', { params }),
  exportBeneficiaries: (params) => apiClient.get('/reports/export/beneficiaries', { params, responseType: 'blob' }),
  exportDistributions: (params) => apiClient.get('/reports/export/distributions', { params, responseType: 'blob' }),
  exportPrograms: (params) => apiClient.get('/reports/export/programs', { params, responseType: 'blob' }),
  exportEnrollments: (params) => apiClient.get('/reports/export/enrollments', { params, responseType: 'blob' }),
};

export const barangayApi = {
  list: () => apiClient.get('/barangays'),
  publicList: () => apiClient.get('/barangays/public'),
};

export const beneficiaryApi = {
  list: () => apiClient.get('/beneficiaries'),
  getMe: () => apiClient.get('/beneficiaries/me'),
  updateMe: (data) => apiClient.put('/beneficiaries/me', data),
  update: (id, data) => apiClient.put(`/beneficiaries/${id}`, data),
  uploadDocument: (formData) => apiClient.post('/beneficiaries/me/documents', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  reuploadDocument: (id, formData) => apiClient.put(`/beneficiaries/me/documents/${id}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  uploadProfilePicture: (formData) => apiClient.post('/beneficiaries/me/profile-picture', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  deleteDocument: (id) => apiClient.delete(`/beneficiaries/me/documents/${id}`),
  submitApplication: (data) => apiClient.post('/beneficiaries/me/submit', data),
  listApplications: () => apiClient.get('/beneficiaries/applications'),
  reviewApplication: (id) => apiClient.put(`/beneficiaries/applications/${id}/review`),
  approveApplication: (id) => apiClient.post(`/beneficiaries/applications/${id}/approve`),
  rejectApplication: (id, data) => apiClient.post(`/beneficiaries/applications/${id}/reject`, data),
};

export const programApi = {
  list: (params) => apiClient.get('/programs', { params }),
  get: (id) => apiClient.get(`/programs/${id}`),
  create: (data) => apiClient.post('/programs', data),
  update: (id, data) => apiClient.put(`/programs/${id}`, data),
  remove: (id) => apiClient.delete(`/programs/${id}`),
  toggleStatus: (id) => apiClient.patch(`/programs/${id}/status`),
  getEnrolledBeneficiaries: (id) => apiClient.get(`/programs/${id}/beneficiaries`),
  enrollBeneficiaries: (id, data) => apiClient.post(`/programs/${id}/enroll`, data),
  autoEnrollBeneficiaries: (id) => apiClient.post(`/programs/${id}/auto-enroll`),
};

export const attendanceApi = {
  list: () => apiClient.get('/attendance'),
  create: (data) => apiClient.post('/attendance', data),
};

export const distributionApi = {
  // Events
  listEvents: (params) => apiClient.get('/distributions/events', { params }),
  getEvent: (id) => apiClient.get(`/distributions/events/${id}`),
  createEvent: (data) => apiClient.post('/distributions/events', data),
  updateEvent: (id, data) => apiClient.put(`/distributions/events/${id}`, data),
  deleteEvent: (id) => apiClient.delete(`/distributions/events/${id}`),
  publishEvent: (id) => apiClient.post(`/distributions/events/${id}/publish`),
  getEligibleBeneficiaries: (id, params) => apiClient.get(`/distributions/events/${id}/eligible-beneficiaries`, { params }),
  getEligibleCount: (id) => apiClient.get(`/distributions/events/${id}/count-eligible`),
  
  // Session Management
  startSession: (id) => apiClient.post(`/distributions/events/${id}/start-session`),
  endSession: (id) => apiClient.post(`/distributions/events/${id}/end-session`),
  updateStatus: (id, data) => apiClient.patch(`/distributions/events/${id}/status`, data),
  
  // Transactions
  getTransactions: (eventId) => apiClient.get(`/distributions/events/${eventId}/transactions`),
  verifyBeneficiary: (data) => apiClient.post('/distributions/verify-beneficiary', data),
  verifyTransaction: (eventId, txnId) => apiClient.post(`/distributions/events/${eventId}/transactions/${txnId}/verify`),
  releaseBenefit: (eventId, txnId, data) => apiClient.post(`/distributions/events/${eventId}/transactions/${txnId}/release`, data),
  getReceipt: (eventId, txnId) => apiClient.get(`/distributions/events/${eventId}/receipt/${txnId}`),
  
  // Dashboard
  getDashboardStats: () => apiClient.get('/distributions/dashboard/stats'),
  
  // Legacy (old distribution model - keep for backward compatibility)
  list: () => apiClient.get('/distributions'),
  create: (data) => apiClient.post('/distributions', data),
  update: (id, data) => apiClient.put(`/distributions/${id}`, data),
  remove: (id) => apiClient.delete(`/distributions/${id}`),
};

export const smsApi = {
  list: () => apiClient.get('/sms'),
};

export const userApi = {
  list: () => apiClient.get('/users'),
  create: (data) => apiClient.post('/users', data),
  update: (id, data) => apiClient.put(`/users/${id}`, data),
  remove: (id) => apiClient.delete(`/users/${id}`),
};

export const seedApi = {
  trigger: () => apiClient.post('/seed'),
};

export const messageApi = {
  contacts: () => apiClient.get('/messages/contacts'),
  conversations: () => apiClient.get('/messages/conversations'),
  getMessages: (partnerId) => apiClient.get(`/messages/${partnerId}`),
  send: (data) => apiClient.post('/messages', data),
  unreadCount: () => apiClient.get('/messages/unread/count'),
};

export const announcementApi = {
  list: (params) => apiClient.get('/announcements', { params }),
  get: (id) => apiClient.get(`/announcements/${id}`),
  create: (data) => apiClient.post('/announcements', data),
  update: (id, data) => apiClient.put(`/announcements/${id}`, data),
  remove: (id) => apiClient.delete(`/announcements/${id}`),
  resend: (id) => apiClient.patch(`/announcements/${id}/resend`),
  markAsRead: (id) => apiClient.patch(`/announcements/${id}/read`),
  previewTargetCount: (params) => apiClient.get('/announcements/preview-count', { params }),
  scanRfid: (id, data) => apiClient.post(`/announcements/${id}/scan-rfid`, data),
  getAttendanceStats: (id) => apiClient.get(`/announcements/${id}/attendance-stats`),
  exportAttendanceReport: (id) => apiClient.get(`/announcements/${id}/export`),
  completeActivity: (id) => apiClient.post(`/announcements/${id}/complete`),
};

export const notificationApi = {
  list: () => apiClient.get('/notifications'),
  unreadCount: () => apiClient.get('/notifications/unread-count'),
  markAsRead: (id) => apiClient.patch(`/notifications/${id}/read`),
  markAllAsRead: () => apiClient.patch('/notifications/mark-all-read'),
};

export default apiClient;
