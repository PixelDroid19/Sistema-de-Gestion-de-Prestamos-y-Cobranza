import { apiRequest } from '@/lib/api/client';

export const agentService = {
  listAgents: () => apiRequest('/api/agents'),
  createAgent: (payload) => apiRequest('/api/agents', { method: 'POST', body: payload }),
};
