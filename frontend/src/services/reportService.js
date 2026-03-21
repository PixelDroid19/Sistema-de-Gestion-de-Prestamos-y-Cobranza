import { apiRequest } from '@/lib/api/client';

export const reportService = {
  getRecoveredLoans: () => apiRequest('/api/reports/recovered'),
  getOutstandingLoans: () => apiRequest('/api/reports/outstanding'),
  getRecoveryReport: () => apiRequest('/api/reports/recovery'),
  getDashboardSummary: () => apiRequest('/api/reports/dashboard'),
  getCustomerHistory: (customerId) => apiRequest(`/api/reports/customer-history/${customerId}`),
  getCustomerCreditProfile: (customerId) => apiRequest(`/api/reports/customer-credit-profile/${customerId}`),
  getCustomerProfitability: (filters = {}) => apiRequest(`/api/reports/profitability/customers${new URLSearchParams(filters).toString() ? `?${new URLSearchParams(filters).toString()}` : ''}`),
  getLoanProfitability: (filters = {}) => apiRequest(`/api/reports/profitability/loans${new URLSearchParams(filters).toString() ? `?${new URLSearchParams(filters).toString()}` : ''}`),
  exportRecoveryReport: (format = 'csv') => apiRequest(`/api/reports/recovery/export?format=${encodeURIComponent(format)}`, { responseType: 'blob' }),
  getLoanCreditHistory: (loanId) => apiRequest(`/api/reports/credit-history/loan/${loanId}`),
  getAssociateProfitability: (associateId = null) => apiRequest(associateId ? `/api/reports/associates/profitability/${associateId}` : '/api/reports/associates/profitability'),
  exportAssociateProfitability: (associateId, format = 'xlsx') => apiRequest(`/api/reports/associates/${associateId}/export?format=${encodeURIComponent(format)}`, { responseType: 'blob' }),
};
