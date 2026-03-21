import { apiRequest } from '@/lib/api/client';

export const paymentService = {
  listPayments: () => apiRequest('/api/payments'),
  listPaymentsByLoan: (loanId) => apiRequest(`/api/payments/loan/${loanId}`),
  createPayment: (payload) => apiRequest('/api/payments', { method: 'POST', body: payload }),
  createPartialPayment: (payload) => apiRequest('/api/payments/partial', { method: 'POST', body: payload }),
  createCapitalPayment: (payload) => apiRequest('/api/payments/capital', { method: 'POST', body: payload }),
  annulInstallment: (loanId) => apiRequest(`/api/payments/annul/${loanId}`, { method: 'POST' }),
  listPaymentDocuments: (paymentId) => apiRequest(`/api/payments/${paymentId}/documents`),
  uploadPaymentDocument: (paymentId, formData) => apiRequest(`/api/payments/${paymentId}/documents`, { method: 'POST', body: formData }),
  downloadPaymentDocument: (paymentId, documentId) => apiRequest(`/api/payments/${paymentId}/documents/${documentId}/download`, { responseType: 'blob' }),
};
