// services/api.ts — PostureAI Mobile
import axios, { AxiosInstance } from 'axios';
import { useAuthStore } from '../stores/authStore';

const BASE = __DEV__
  ? 'http://localhost:5000'
  : 'https://api.postureai.com';

const api: AxiosInstance = axios.create({ baseURL: BASE, timeout: 30_000 });

// Attach auth token to every request
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-logout on 401
api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) useAuthStore.getState().logout();
    return Promise.reject(err);
  }
);

// ── Analysis ─────────────────────────────────────────────────────
export const analyzeFrame = (imageBase64: string, mode = 'phone') =>
  api.post('/api/analyze', { image: imageBase64, mode, source: 'mobile' });

export const submitSession = (data: {
  frames_analyzed: number;
  avg_score: number;
  duration_seconds: number;
  alerts: string[];
  mode: string;
}) => api.post('/api/sessions', data);

// ── Sessions / History ────────────────────────────────────────────
export const getSessions = (limit = 30, offset = 0) =>
  api.get('/api/sessions', { params: { limit, offset } });

export const getSessionDetail = (id: string) =>
  api.get(`/api/sessions/${id}`);

export const deleteSession = (id: string) =>
  api.delete(`/api/sessions/${id}`);

// ── User / Profile ────────────────────────────────────────────────
export const getProfile = () => api.get('/api/profile');
export const updateProfile = (data: object) => api.put('/api/profile', data);
export const getStats = () => api.get('/api/stats');

// ── Teams / Org ───────────────────────────────────────────────────
export const getOrgMembers = () => api.get('/api/org/members');
export const getLeaderboard = () => api.get('/api/leaderboard');
export const inviteMember = (email: string) => api.post('/api/invite', { email });

// ── Notifications ─────────────────────────────────────────────────
export const registerPushToken = (token: string, platform: string) =>
  api.post('/api/notifications/register', { token, platform });

export const getNotifications = () => api.get('/api/notifications');
export const markNotificationRead = (id: string) =>
  api.patch(`/api/notifications/${id}/read`);

// ── Reports ───────────────────────────────────────────────────────
export const requestAIReport = (period: '7d' | '30d' | '90d') =>
  api.post('/api/reports/ai', { period });

export const getWeeklyReport = () => api.get('/api/reports/weekly');

export default api;
