import { apiRequest } from '../lib/api/client';

export const paymentService = {
  listPayments: () => apiRequest('/api/payments'),
  listPaymentsByLoan: (loanId) => apiRequest(`/api/payments/loan/${loanId}`),
  createPayment: (payload) => apiRequest('/api/payments', { method: 'POST', body: payload }),
};
