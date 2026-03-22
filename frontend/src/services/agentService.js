import { apiRequest } from '@/lib/api/client';
import { buildPaginatedCollection, withPaginationParams } from '@/lib/api/pagination';

export const agentService = {
  listAgents: async (pagination) => buildPaginatedCollection(await apiRequest(withPaginationParams('/api/agents', pagination)), 'agents'),
  createAgent: (payload) => apiRequest('/api/agents', { method: 'POST', body: payload }),
};
