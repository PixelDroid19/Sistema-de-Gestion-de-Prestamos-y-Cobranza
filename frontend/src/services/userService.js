import { apiRequest } from '../lib/api/client';

export const userService = {
  listUsers: () => apiRequest('/api/users'),
  getUser: (userId) => apiRequest(`/api/users/${userId}`),
  updateUser: (userId, payload) => apiRequest(`/api/users/${userId}`, { method: 'PUT', body: payload }),
  deactivateUser: (userId) => apiRequest(`/api/users/${userId}/deactivate`, { method: 'POST' }),
  reactivateUser: (userId) => apiRequest(`/api/users/${userId}/reactivate`, { method: 'POST' }),
};
