import { apiRequest } from '@/lib/api/client';
import { buildPaginatedCollection, withPaginationParams } from '@/lib/api/pagination';

export const paymentService = {
  listPayments: async (pagination) => buildPaginatedCollection(await apiRequest(withPaginationParams('/api/payments', pagination)), 'payments'),
  listPaymentsByLoan: async (loanId, pagination) => buildPaginatedCollection(await apiRequest(withPaginationParams(`/api/payments/loan/${loanId}`, pagination)), 'payments'),
  createPayment: (payload) => apiRequest('/api/payments', { method: 'POST', body: payload }),
  createPartialPayment: (payload) => apiRequest('/api/payments/partial', { method: 'POST', body: payload }),
  createCapitalPayment: (payload) => apiRequest('/api/payments/capital', { method: 'POST', body: payload }),
  annulInstallment: (loanId, payload = {}) => apiRequest(`/api/payments/annul/${loanId}`, { method: 'POST', body: payload }),
  updatePaymentMetadata: (paymentId, payload) => apiRequest(`/api/payments/${paymentId}/metadata`, { method: 'PATCH', body: payload }),
  listPaymentDocuments: (paymentId) => apiRequest(`/api/payments/${paymentId}/documents`),
  uploadPaymentDocument: (paymentId, formData) => apiRequest(`/api/payments/${paymentId}/documents`, { method: 'POST', body: formData }),
  downloadPaymentDocument: (paymentId, documentId) => apiRequest(`/api/payments/${paymentId}/documents/${documentId}/download`, { responseType: 'blob' }),
  listPaymentMethods: () => apiRequest('/api/config/payment-methods'),
};
