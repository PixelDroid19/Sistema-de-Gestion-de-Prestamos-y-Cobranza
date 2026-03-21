export const queryKeys = {
  auth: {
    profile: () => ['auth', 'profile'],
  },
  dashboard: {
    summary: () => ['dashboard', 'summary'],
  },
  loans: {
    all: (scope = 'all') => ['loans', scope],
    detail: (loanId) => ['loans', 'detail', loanId],
    payments: (loanId) => ['loans', loanId, 'payments'],
    alerts: (loanId) => ['loans', loanId, 'alerts'],
    calendar: (loanId) => ['loans', loanId, 'calendar'],
    promises: (loanId) => ['loans', loanId, 'promises'],
    attachments: (loanId) => ['loans', loanId, 'attachments'],
    payoffQuote: (loanId, asOfDate) => ['loans', loanId, 'payoff-quote', asOfDate || 'today'],
  },
  payments: {
    all: () => ['payments'],
    byLoan: (loanId) => ['payments', 'loan', loanId],
    documents: (paymentId) => ['payments', 'documents', paymentId],
  },
  agents: {
    all: () => ['agents'],
  },
  customers: {
    all: () => ['customers'],
    documents: (customerId) => ['customers', customerId, 'documents'],
    history: (customerId) => ['customers', customerId, 'history'],
  },
  associates: {
    all: () => ['associates'],
    detail: (associateId) => ['associates', associateId],
    portal: (associateId) => ['associates', associateId || 'me', 'portal'],
    profitability: (associateId) => ['associates', associateId || 'me', 'profitability'],
  },
  reports: {
    dashboard: () => ['reports', 'dashboard'],
    recovery: () => ['reports', 'recovery'],
    recovered: () => ['reports', 'recovered'],
    outstanding: () => ['reports', 'outstanding'],
    creditHistory: (loanId) => ['reports', 'credit-history', loanId],
    customerCreditProfile: (customerId) => ['reports', 'customer-credit-profile', customerId],
    customerProfitability: (filters = {}) => ['reports', 'customer-profitability', filters.fromDate || 'all', filters.toDate || 'all'],
    loanProfitability: (filters = {}) => ['reports', 'loan-profitability', filters.fromDate || 'all', filters.toDate || 'all'],
  },
  notifications: {
    all: () => ['notifications'],
    unreadCount: () => ['notifications', 'unread-count'],
  },
  users: {
    all: () => ['users'],
    detail: (userId) => ['users', userId],
  },
};
