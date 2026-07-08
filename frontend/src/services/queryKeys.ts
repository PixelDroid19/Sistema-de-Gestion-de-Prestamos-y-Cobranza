export type LoanListParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
};

export type AuditLogKeyFilters = {
  userId?: string;
  action?: string;
  module?: string;
  entityId?: string;
  entityType?: string;
  ip?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
};

export type PaymentListParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
};

export type CustomerListParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  registeredWithin?: string;
};

export type UserListParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  role?: string;
};

export type AssociateListParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
};

export type MonthlyCashFlowFilters = {
  fromDate?: string;
  toDate?: string;
};

export type DailyCashFlowFilters = {
  date?: string;
  fromDate?: string;
  toDate?: string;
};

export type AnnualCashFlowFilters = {
  fromYear?: number;
  toYear?: number;
};

export type CreditHistoryMonthlyFilters = {
  startDate?: string;
  endDate?: string;
  status?: string;
  customerId?: number;
  loanId?: number;
  financialProductId?: string;
};

export type PaymentCalendarOverviewFilters = {
  asOfDate?: string;
  search?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
};

export type OperatingExpenseListParams = {
  page?: number;
  pageSize?: number;
  fromDate?: string;
  toDate?: string;
  status?: string;
  employeeId?: string;
};

export type AssociateCalendarFilters = {
  startDate?: string;
  endDate?: string;
};

export type AssociateTrackingFilters = {
  search?: string;
  status?: string;
};

export const queryKeys = {
  customers: {
    all: ['customers'] as const,
    list: (params?: CustomerListParams) => ['customers', 'list', params ?? {}] as const,
    detail: (customerId: number) => ['customers', 'detail', customerId] as const,
    documents: (customerId: number) => ['customers', 'documents', customerId] as const,
  },
  users: {
    all: ['users'] as const,
    list: (params?: UserListParams) => ['users.list', params ?? {}] as const,
  },
  associates: {
    all: ['associates'] as const,
    list: (params?: AssociateListParams) => ['associates', 'list', params ?? {}] as const,
    detail: (associateId: number) => ['associates', 'detail', associateId] as const,
    financialDetails: (associateId: number) => ['associates', 'financial-details', associateId] as const,
    tracking: (filters?: AssociateTrackingFilters) => ['associates', 'tracking', filters ?? {}] as const,
    installments: (associateId: number) => ['associates', 'installments', associateId] as const,
    calendar: (associateId: number, filters?: AssociateCalendarFilters) =>
      ['associates', 'calendar', associateId, filters ?? {}] as const,
  },
  config: {
    paymentMethods: ['config.paymentMethods'] as const,
    activePaymentMethods: ['config.activePaymentMethods'] as const,
    ratePolicies: ['config.ratePolicies'] as const,
    lateFeePolicies: ['config.lateFeePolicies'] as const,
    settings: ['config.settings'] as const,
    catalogs: ['config.catalogs'] as const,
    roles: ['config.roles'] as const,
  },
  loans: {
    all: ['loans'] as const,
    listRoot: ['loans.list'] as const,
    list: (params?: LoanListParams) => ['loans.list', params ?? {}] as const,
    byCustomer: (customerId: number, params?: { page?: number; pageSize?: number }) =>
      ['loans.byCustomer', customerId, params ?? {}] as const,
    detail: (loanId: number) => ['loans.detail', loanId] as const,
    calendar: (loanId: number) => ['loans.calendar', loanId] as const,
    installmentQuote: (loanId: number, installmentNumber: number | null, asOfDate: string) =>
      ['loans.installmentQuote', loanId, installmentNumber, asOfDate] as const,
    alerts: (loanId: number) => ['loans.alerts', loanId] as const,
    promises: (loanId: number) => ['loans.promises', loanId] as const,
    payoffQuote: (loanId: number, asOfDate: string) => ['loans.payoffQuote', loanId, asOfDate] as const,
    statistics: ['loans.statistics'] as const,
    duePayments: (date: string) => ['loans.duePayments', date] as const,
    calculation: (params: { amount: number; interestRate: number; termMonths: number }) =>
      ['loans.calculation', params] as const,
  },
  payments: {
    all: ['payments'] as const,
    listRoot: ['payments.list'] as const,
    list: (params?: PaymentListParams) => ['payments.list', params ?? {}] as const,
    capitalPreview: (loanId?: number | string, amount?: string, asOfDate?: string, strategy?: string, newTermMonths?: string) =>
      ['payments.capitalPreview', loanId ?? null, amount ?? '', asOfDate ?? '', strategy ?? '', newTermMonths ?? ''] as const,
  },
  notifications: {
    all: ['notifications'] as const,
    list: ['notifications.list'] as const,
    unreadCount: ['notifications.unreadCount'] as const,
  },
  reports: {
    all: ['reports'] as const,
    dashboard: ['reports.dashboard'] as const,
    outstanding: ['reports.outstanding'] as const,
    recovered: ['reports.recovered'] as const,
    recovery: ['reports.recovery'] as const,
    customerHistory: (customerId: number) => ['reports.customerHistory', customerId] as const,
    customerCreditProfile: (customerId: number) => ['reports.customerCreditProfile', customerId] as const,
    creditHistory: (loanId: number) => ['reports.creditHistory', loanId] as const,
    creditEarnings: ['reports.creditEarnings'] as const,
    interestEarnings: (year?: number) => ['reports.interestEarnings', year] as const,
    monthlyEarnings: (year?: number) => ['reports.monthlyEarnings', year] as const,
    monthlyCashFlow: (year?: number, filters?: MonthlyCashFlowFilters) =>
      ['reports.monthlyCashFlow', year, filters ?? {}] as const,
    dailyCashFlow: (filters?: DailyCashFlowFilters) =>
      ['reports.dailyCashFlow', filters ?? {}] as const,
    annualCashFlow: (filters?: AnnualCashFlowFilters) =>
      ['reports.annualCashFlow', filters ?? {}] as const,
    creditHistoryMonthly: (filters?: CreditHistoryMonthlyFilters) =>
      ['reports.creditHistoryMonthly', filters ?? {}] as const,
    creditHistoryFinancialProducts: ['reports.creditHistoryFinancialProducts'] as const,
    payoutsRoot: ['reports.payouts'] as const,
    payouts: (filters: object, page: number, pageSize: number) =>
      ['reports.payouts', filters, page, pageSize] as const,
    paymentCalendarOverview: (filters?: PaymentCalendarOverviewFilters) =>
      ['reports.paymentCalendarOverview', filters ?? {}] as const,
    paymentSchedule: (loanId: number | null) => ['reports.paymentSchedule', loanId] as const,
  },
  operatingExpenses: {
    all: ['operatingExpenses'] as const,
    list: (params?: OperatingExpenseListParams) => ['operatingExpenses', 'list', params ?? {}] as const,
  },
  timeline: {
    loan: (loanId: number) => ['loans.timeline', loanId] as const,
  },
  audit: {
    all: ['audit'] as const,
    logs: (filters: AuditLogKeyFilters = {}) => ['audit.logs', filters] as const,
    stats: (dateFrom?: string, dateTo?: string) => ['audit.stats', dateFrom, dateTo] as const,
  },
  permissions: {
    all: ['permissions'] as const,
    list: ['permissions.list'] as const,
    byModule: (module: string) => ['permissions.byModule', module] as const,
    myPermissions: ['permissions.myPermissions'] as const,
    myPermissionsSummary: ['permissions.myPermissionsSummary'] as const,
    userRoot: ['permissions.user'] as const,
    user: (userId: string | number) => ['permissions.user', userId] as const,
  },
};
