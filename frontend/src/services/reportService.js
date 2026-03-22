import { apiRequest } from '@/lib/api/client';
import { buildPaginatedCollection, withPaginationParams } from '@/lib/api/pagination';

export const reportService = {
  getRecoveredLoans: async (pagination) => buildPaginatedCollection(await apiRequest(withPaginationParams('/api/reports/recovered', pagination)), 'loans'),
  getOutstandingLoans: async (pagination) => buildPaginatedCollection(await apiRequest(withPaginationParams('/api/reports/outstanding', pagination)), 'loans'),
  getRecoveryReport: () => apiRequest('/api/reports/recovery'),
  getDashboardSummary: () => apiRequest('/api/reports/dashboard'),
  getCustomerHistory: (customerId) => apiRequest(`/api/reports/customer-history/${customerId}`),
  getCustomerCreditProfile: (customerId) => apiRequest(`/api/reports/customer-credit-profile/${customerId}`),
  getCustomerProfitability: async (filters = {}, pagination) => buildPaginatedCollection(await apiRequest(withPaginationParams('/api/reports/profitability/customers', pagination, filters)), 'customers'),
  getLoanProfitability: async (filters = {}, pagination) => buildPaginatedCollection(await apiRequest(withPaginationParams('/api/reports/profitability/loans', pagination, filters)), 'loans'),
  exportRecoveryReport: (format = 'csv') => apiRequest(`/api/reports/recovery/export?format=${encodeURIComponent(format)}`, { responseType: 'blob' }),
  getLoanCreditHistory: (loanId) => apiRequest(`/api/reports/credit-history/loan/${loanId}`),
  getAssociateProfitability: (associateId = null) => apiRequest(associateId ? `/api/reports/associates/profitability/${associateId}` : '/api/reports/associates/profitability'),
  exportAssociateProfitability: (associateId, format = 'xlsx') => apiRequest(`/api/reports/associates/${associateId}/export?format=${encodeURIComponent(format)}`, { responseType: 'blob' }),
};
