export type LoanListParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
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

export const queryKeys = {
  customers: {
    all: ['customers'] as const,
    list: (params?: CustomerListParams) => ['customers.list', params ?? {}] as const,
    documents: (customerId: number) => ['customers.documents', customerId] as const,
  },
  users: {
    all: ['users'] as const,
    list: (params?: UserListParams) => ['users.list', params ?? {}] as const,
  },
  associates: {
    all: ['associates'] as const,
    list: (params?: AssociateListParams) => ['associates.list', params ?? {}] as const,
    portal: (associateId: number) => ['associates.portal', associateId] as const,
    installments: (associateId: number) => ['associates.installments', associateId] as const,
    calendar: (associateId: number) => ['associates.calendar', associateId] as const,
  },
  config: {
    paymentMethods: ['config.paymentMethods'] as const,
    settings: ['config.settings'] as const,
    catalogs: ['config.catalogs'] as const,
    roles: ['config.roles'] as const,
  },
  loans: {
    all: ['loans'] as const,
    listRoot: ['loans.list'] as const,
    list: (params?: LoanListParams) => ['loans.list', params ?? {}] as const,
    workbenchScopes: ['loans.workbench.scopes'] as const,
    detail: (loanId: number) => ['loans.detail', loanId] as const,
    calendar: (loanId: number) => ['loans.calendar', loanId] as const,
    alerts: (loanId: number) => ['loans.alerts', loanId] as const,
    promises: (loanId: number) => ['loans.promises', loanId] as const,
    payoffQuote: (loanId: number, asOfDate: string) => ['loans.payoffQuote', loanId, asOfDate] as const,
    statistics: ['loans.statistics'] as const,
    duePayments: (date: string) => ['loans.duePayments', date] as const,
    calculation: (params: { amount: number; interestRate: number; termMonths: number }) =>
      ['loans.calculation', params] as const,
    simulation: (params: { amount: number; interestRate: number; termMonths: number }) =>
      ['loans.calculation', params] as const,
  },
  payments: {
    all: ['payments'] as const,
    listRoot: ['payments.list'] as const,
    list: (params?: PaymentListParams) => ['payments.list', params ?? {}] as const,
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
    profitabilityCustomers: ['reports.profitability.customers'] as const,
    profitabilityLoans: ['reports.profitability.loans'] as const,
    customerHistory: (customerId: number) => ['reports.customerHistory', customerId] as const,
    customerCreditProfile: (customerId: number) => ['reports.customerCreditProfile', customerId] as const,
    creditHistory: (loanId: number) => ['reports.creditHistory', loanId] as const,
    creditEarnings: ['reports.creditEarnings'] as const,
    interestEarnings: (year?: number) => ['reports.interestEarnings', year] as const,
    monthlyEarnings: (year?: number) => ['reports.monthlyEarnings', year] as const,
    monthlyInterest: (year?: number) => ['reports.monthlyInterest', year] as const,
    performanceAnalysis: (year?: number) => ['reports.performanceAnalysis', year] as const,
    executiveDashboard: ['reports.executiveDashboard'] as const,
    comprehensiveAnalytics: (year?: number) => ['reports.comprehensiveAnalytics', year] as const,
    comparativeAnalysis: (year?: number) => ['reports.comparativeAnalysis', year] as const,
    forecastAnalysis: (year?: number) => ['reports.forecastAnalysis', year] as const,
    nextMonthProjection: ['reports.nextMonthProjection'] as const,
    payoutsRoot: ['reports.payouts'] as const,
    payouts: (filters: object, page: number, pageSize: number) =>
      ['reports.payouts', filters, page, pageSize] as const,
    paymentSchedule: (loanId: number | null) => ['reports.paymentSchedule', loanId] as const,
  },
  timeline: {
    loan: (loanId: number) => ['loans.timeline', loanId] as const,
  },
  dag: {
    graphs: (scopeKey: string) => ['dag.graphs', scopeKey] as const,
    history: (graphId: number) => ['dag.history', graphId] as const,
    diff: (graphId: number, compareToGraphId: number) => ['dag.diff', graphId, compareToGraphId] as const,
  },
  variables: {
    all: ['variables'] as const,
    list: (params?: object) => ['variables.list', params ?? {}] as const,
    detail: (id: number) => ['variables.detail', id] as const,
  },
};
