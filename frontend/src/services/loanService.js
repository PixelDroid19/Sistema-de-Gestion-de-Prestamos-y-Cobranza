import { apiRequest } from '@/lib/api/client';
import { buildPaginatedCollection, withPaginationParams } from '@/lib/api/pagination';

export const loanService = {
  listLoans: async (pagination) => buildPaginatedCollection(await apiRequest(withPaginationParams('/api/loans', pagination)), 'loans'),
  listLoansByCustomer: async (customerId, pagination) => buildPaginatedCollection(await apiRequest(withPaginationParams(`/api/loans/customer/${customerId}`, pagination)), 'loans'),
  listRecoveryRoster: async (pagination) => buildPaginatedCollection(await apiRequest(withPaginationParams('/api/loans/recovery-roster', pagination)), 'recoveryRoster'),
  getLoanById: (loanId) => apiRequest(`/api/loans/${loanId}`),
  createLoan: (payload) => apiRequest('/api/loans', { method: 'POST', body: payload }),
  simulateLoan: (payload) => apiRequest('/api/loans/simulations', { method: 'POST', body: payload }),
  updateLoanStatus: (loanId, status) => apiRequest(`/api/loans/${loanId}/status`, { method: 'PATCH', body: { status } }),
  assignRecoveryAssignee: (loanId, recoveryAssigneeId) => apiRequest(`/api/loans/${loanId}/recovery-assignment`, { method: 'PATCH', body: { recoveryAssigneeId } }),
  updateRecoveryStatus: (loanId, recoveryStatus) => apiRequest(`/api/loans/${loanId}/recovery-status`, { method: 'PATCH', body: { recoveryStatus } }),
  getLoanAttachments: (loanId) => apiRequest(`/api/loans/${loanId}/attachments`),
  uploadLoanAttachment: (loanId, formData) => apiRequest(`/api/loans/${loanId}/attachments`, { method: 'POST', body: formData }),
  downloadLoanAttachment: (loanId, attachmentId) => apiRequest(`/api/loans/${loanId}/attachments/${attachmentId}/download`, { responseType: 'blob' }),
  getLoanAlerts: (loanId) => apiRequest(`/api/loans/${loanId}/alerts`),
  createLoanFollowUp: (loanId, payload) => apiRequest(`/api/loans/${loanId}/follow-ups`, { method: 'POST', body: payload }),
  updateLoanAlertStatus: (loanId, alertId, payload) => apiRequest(`/api/loans/${loanId}/alerts/${alertId}/status`, { method: 'PATCH', body: payload }),
  getLoanCalendar: (loanId) => apiRequest(`/api/loans/${loanId}/calendar`),
  getPayoffQuote: (loanId, asOfDate) => apiRequest(`/api/loans/${loanId}/payoff-quote${asOfDate ? `?asOfDate=${encodeURIComponent(asOfDate)}` : ''}`),
  executePayoff: (loanId, payload) => apiRequest(`/api/loans/${loanId}/payoff-executions`, { method: 'POST', body: payload }),
  getLoanPromises: (loanId) => apiRequest(`/api/loans/${loanId}/promises`),
  createLoanPromise: (loanId, payload) => apiRequest(`/api/loans/${loanId}/promises`, { method: 'POST', body: payload }),
  updateLoanPromiseStatus: (loanId, promiseId, payload) => apiRequest(`/api/loans/${loanId}/promises/${promiseId}/status`, { method: 'PATCH', body: payload }),
  downloadLoanPromise: (loanId, promiseId) => apiRequest(`/api/loans/${loanId}/promises/${promiseId}/download`, { responseType: 'blob' }),
  deleteLoan: (loanId) => apiRequest(`/api/loans/${loanId}`, { method: 'DELETE' }),
};
