import { apiRequest } from '@/lib/api/client';

export const dagService = {
  loadGraph: (scopeKey) => apiRequest(`/api/loans/workbench/graph?scope=${encodeURIComponent(scopeKey)}`),
  saveGraph: ({ scopeKey, name, graph }) => apiRequest('/api/loans/workbench/graph', {
    method: 'POST',
    body: { scopeKey, name, graph },
  }),
  validateGraph: ({ scopeKey, graph }) => apiRequest('/api/loans/workbench/graph/validate', {
    method: 'POST',
    body: { scopeKey, graph },
  }),
  simulateGraph: ({ scopeKey, graph, simulationInput }) => apiRequest('/api/loans/workbench/graph/simulations', {
    method: 'POST',
    body: { scopeKey, graph, simulationInput },
  }),
  getSummary: (scopeKey) => apiRequest(`/api/loans/workbench/graph/summary?scope=${encodeURIComponent(scopeKey)}`),
};
