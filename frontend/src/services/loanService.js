import { apiRequest } from '@/lib/api/client';

export const loanService = {
  listLoans: () => apiRequest('/api/loans'),
  listLoansByCustomer: (customerId) => apiRequest(`/api/loans/customer/${customerId}`),
  listLoansByAgent: (agentId) => apiRequest(`/api/loans/agent/${agentId}`),
  getLoanById: (loanId) => apiRequest(`/api/loans/${loanId}`),
  createLoan: (payload) => apiRequest('/api/loans', { method: 'POST', body: payload }),
  simulateLoan: (payload) => apiRequest('/api/loans/simulations', { method: 'POST', body: payload }),
  updateLoanStatus: (loanId, status) => apiRequest(`/api/loans/${loanId}/status`, { method: 'PATCH', body: { status } }),
  assignAgent: (loanId, agentId) => apiRequest(`/api/loans/${loanId}/assign-agent`, { method: 'PATCH', body: { agentId } }),
  updateRecoveryStatus: (loanId, recoveryStatus) => apiRequest(`/api/loans/${loanId}/recovery-status`, { method: 'PATCH', body: { recoveryStatus } }),
  getLoanAttachments: (loanId) => apiRequest(`/api/loans/${loanId}/attachments`),
  uploadLoanAttachment: (loanId, formData) => apiRequest(`/api/loans/${loanId}/attachments`, { method: 'POST', body: formData }),
  downloadLoanAttachment: (loanId, attachmentId) => apiRequest(`/api/loans/${loanId}/attachments/${attachmentId}/download`, { responseType: 'blob' }),
  getLoanAlerts: (loanId) => apiRequest(`/api/loans/${loanId}/alerts`),
  getLoanCalendar: (loanId) => apiRequest(`/api/loans/${loanId}/calendar`),
  getPayoffQuote: (loanId, asOfDate) => apiRequest(`/api/loans/${loanId}/payoff-quote${asOfDate ? `?asOfDate=${encodeURIComponent(asOfDate)}` : ''}`),
  executePayoff: (loanId, payload) => apiRequest(`/api/loans/${loanId}/payoff-executions`, { method: 'POST', body: payload }),
  getLoanPromises: (loanId) => apiRequest(`/api/loans/${loanId}/promises`),
  createLoanPromise: (loanId, payload) => apiRequest(`/api/loans/${loanId}/promises`, { method: 'POST', body: payload }),
  downloadLoanPromise: (loanId, promiseId) => apiRequest(`/api/loans/${loanId}/promises/${promiseId}/download`, { responseType: 'blob' }),
  deleteLoan: (loanId) => apiRequest(`/api/loans/${loanId}`, { method: 'DELETE' }),
};
