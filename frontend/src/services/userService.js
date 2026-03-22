import { apiRequest } from '@/lib/api/client';
import { buildPaginatedCollection, withPaginationParams } from '@/lib/api/pagination';

export const userService = {
  listUsers: async (pagination) => buildPaginatedCollection(await apiRequest(withPaginationParams('/api/users', pagination)), 'users'),
  getUser: (userId) => apiRequest(`/api/users/${userId}`),
  updateUser: (userId, payload) => apiRequest(`/api/users/${userId}`, { method: 'PUT', body: payload }),
  deactivateUser: (userId) => apiRequest(`/api/users/${userId}/deactivate`, { method: 'POST' }),
  reactivateUser: (userId) => apiRequest(`/api/users/${userId}/reactivate`, { method: 'POST' }),
};
