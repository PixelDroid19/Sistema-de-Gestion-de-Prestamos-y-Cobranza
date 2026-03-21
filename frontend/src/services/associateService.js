import { apiRequest } from '@/lib/api/client';

export const associateService = {
  listAssociates: () => apiRequest('/api/associates'),
  createAssociate: (payload) => apiRequest('/api/associates', { method: 'POST', body: payload }),
  getAssociateById: (associateId) => apiRequest(`/api/associates/${associateId}`),
  updateAssociate: (associateId, payload) => apiRequest(`/api/associates/${associateId}`, { method: 'PATCH', body: payload }),
  deleteAssociate: (associateId) => apiRequest(`/api/associates/${associateId}`, { method: 'DELETE' }),
  getAssociatePortal: (associateId = null) => apiRequest(associateId ? `/api/associates/${associateId}/portal` : '/api/associates/portal/me'),
  createContribution: (associateId, payload) => apiRequest(`/api/associates/${associateId}/contributions`, { method: 'POST', body: payload }),
  createDistribution: (associateId, payload) => apiRequest(`/api/associates/${associateId}/distributions`, { method: 'POST', body: payload }),
  createReinvestment: (associateId, payload) => apiRequest(`/api/associates/${associateId}/reinvestments`, { method: 'POST', body: payload }),
  createProportionalDistribution: (payload, idempotencyKey) => apiRequest('/api/associates/distributions/proportional', {
    method: 'POST',
    body: payload,
    headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {},
  }),
};
