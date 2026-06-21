import axios from 'axios';
import { io } from 'socket.io-client';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Axios Instance
export const apiClient = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Accounts API
export const accountsApi = {
  getAll: () => apiClient.get('/api/accounts').then(r => r.data),
  create: (data) => apiClient.post('/api/accounts', data).then(r => r.data),
  update: (id, data) => apiClient.put(`/api/accounts/${id}`, data).then(r => r.data),
  delete: (id) => apiClient.delete(`/api/accounts/${id}`).then(r => r.data),
};

// Automation API
export const collectApi = {
  triggerOne: (id) => apiClient.post(`/api/collect/${id}`).then(r => r.data),
  triggerAll: () => apiClient.post('/api/collect/all').then(r => r.data),
};

// Logs API
export const logsApi = {
  get: (params) => apiClient.get('/api/logs', { params }).then(r => r.data),
  getExportUrl: (params) => {
    const query = new URLSearchParams(params).toString();
    return `${API_BASE}/api/logs?export=csv&${query}`;
  },
};

// Stats API
export const statsApi = {
  get: () => apiClient.get('/api/stats').then(r => r.data),
};

// WebSockets Connection
export const socket = io(API_BASE);
export { API_BASE };
