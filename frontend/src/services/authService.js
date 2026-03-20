import { apiRequest } from '@/lib/api/client';

export const authService = {
  login: (credentials) => apiRequest('/api/auth/login', { method: 'POST', body: credentials }),
  register: (payload) => apiRequest('/api/auth/register', { method: 'POST', body: payload }),
  adminRegister: (payload) => apiRequest('/api/auth/admin/register', { method: 'POST', body: payload }),
  getProfile: () => apiRequest('/api/auth/profile'),
  updateProfile: (payload) => apiRequest('/api/auth/profile', { method: 'PUT', body: payload }),
};
