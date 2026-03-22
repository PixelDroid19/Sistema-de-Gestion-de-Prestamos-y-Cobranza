import { apiRequest } from '@/lib/api/client';
import { buildPaginatedCollection, withPaginationParams } from '@/lib/api/pagination';

export const customerService = {
  listCustomers: async (pagination) => buildPaginatedCollection(await apiRequest(withPaginationParams('/api/customers', pagination)), 'customers'),
  createCustomer: (payload) => apiRequest('/api/customers', { method: 'POST', body: payload }),
  listDocuments: (customerId) => apiRequest(`/api/customers/${customerId}/documents`),
  uploadDocument: (customerId, formData) => apiRequest(`/api/customers/${customerId}/documents`, { method: 'POST', body: formData }),
  downloadDocument: (customerId, documentId) => apiRequest(`/api/customers/${customerId}/documents/${documentId}/download`, { responseType: 'blob' }),
  deleteDocument: (customerId, documentId) => apiRequest(`/api/customers/${customerId}/documents/${documentId}`, { method: 'DELETE' }),
};
