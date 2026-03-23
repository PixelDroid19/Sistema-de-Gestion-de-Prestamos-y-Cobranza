import { normalizePaginationState } from '@/lib/api/pagination';

const pagedKey = (segments, pagination = {}) => {
  const normalized = normalizePaginationState(pagination);
  return [...segments, 'page', normalized.page, normalized.pageSize];
};

export const queryKeys = {
  auth: {
    profile: () => ['auth', 'profile'],
    password: () => ['auth', 'password'],
  },
  dashboard: {
    summary: () => ['dashboard', 'summary'],
  },
  loans: {
    all: (scope = 'all') => ['loans', scope],
    paged: (scope = 'all', pagination = {}) => pagedKey(['loans', scope], pagination),
    detail: (loanId) => ['loans', 'detail', loanId],
    payments: (loanId) => ['loans', loanId, 'payments'],
    alerts: (loanId) => ['loans', loanId, 'alerts'],
    calendar: (loanId) => ['loans', loanId, 'calendar'],
    promises: (loanId) => ['loans', loanId, 'promises'],
    attachments: (loanId) => ['loans', loanId, 'attachments'],
    payoffQuote: (loanId, asOfDate) => ['loans', loanId, 'payoff-quote', asOfDate || 'today'],
  },
  dag: {
    graph: (scopeKey = 'default') => ['dag', 'graph', scopeKey],
    summary: (scopeKey = 'default') => ['dag', 'summary', scopeKey],
  },
  payments: {
    all: () => ['payments'],
    paged: (pagination = {}) => pagedKey(['payments'], pagination),
    byLoan: (loanId) => ['payments', 'loan', loanId],
    byLoanPaged: (loanId, pagination = {}) => pagedKey(['payments', 'loan', loanId], pagination),
    documents: (paymentId) => ['payments', 'documents', paymentId],
  },
  recoveryRoster: {
    all: () => ['recovery-roster'],
    paged: (pagination = {}) => pagedKey(['recovery-roster'], pagination),
  },
  customers: {
    all: () => ['customers'],
    paged: (pagination = {}) => pagedKey(['customers'], pagination),
    documents: (customerId) => ['customers', customerId, 'documents'],
    history: (customerId) => ['customers', customerId, 'history'],
  },
  associates: {
    all: () => ['associates'],
    paged: (pagination = {}) => pagedKey(['associates'], pagination),
    detail: (associateId) => ['associates', associateId],
    portal: (associateId) => ['associates', associateId || 'me', 'portal'],
    profitability: (associateId) => ['associates', associateId || 'me', 'profitability'],
  },
  reports: {
    dashboard: () => ['reports', 'dashboard'],
    recovery: () => ['reports', 'recovery'],
    recovered: (pagination = {}) => pagedKey(['reports', 'recovered'], pagination),
    outstanding: (pagination = {}) => pagedKey(['reports', 'outstanding'], pagination),
    creditHistory: (loanId) => ['reports', 'credit-history', loanId],
    customerCreditProfile: (customerId) => ['reports', 'customer-credit-profile', customerId],
    customerProfitability: (filters = {}, pagination = {}) => pagedKey(['reports', 'customer-profitability', filters.fromDate || 'all', filters.toDate || 'all'], pagination),
    loanProfitability: (filters = {}, pagination = {}) => pagedKey(['reports', 'loan-profitability', filters.fromDate || 'all', filters.toDate || 'all'], pagination),
  },
  notifications: {
    all: () => ['notifications'],
    unreadCount: () => ['notifications', 'unread-count'],
  },
  users: {
    all: () => ['users'],
    paged: (pagination = {}) => pagedKey(['users'], pagination),
    detail: (userId) => ['users', userId],
  },
  config: {
    paymentMethods: () => ['config', 'payment-methods'],
    settings: () => ['config', 'settings'],
    catalogs: () => ['config', 'catalogs'],
  },
};
