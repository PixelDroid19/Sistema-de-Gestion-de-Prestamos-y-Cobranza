import { apiRequest } from '@/lib/api/client';

export const customerService = {
  listCustomers: () => apiRequest('/api/customers'),
  createCustomer: (payload) => apiRequest('/api/customers', { method: 'POST', body: payload }),
  listDocuments: (customerId) => apiRequest(`/api/customers/${customerId}/documents`),
  uploadDocument: (customerId, formData) => apiRequest(`/api/customers/${customerId}/documents`, { method: 'POST', body: formData }),
  downloadDocument: (customerId, documentId) => apiRequest(`/api/customers/${customerId}/documents/${documentId}/download`, { responseType: 'blob' }),
  deleteDocument: (customerId, documentId) => apiRequest(`/api/customers/${customerId}/documents/${documentId}`, { method: 'DELETE' }),
};
