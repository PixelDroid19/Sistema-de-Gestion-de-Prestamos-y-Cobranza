export interface PayoutSummary {
  totalPayouts: number;
  totalAmount: string;
  totalPrincipal: string;
  totalInterest: string;
  totalPenalties: string;
  collectionBreakdown?: {
    daily: PayoutCollectionBucket[];
    weekly: PayoutCollectionBucket[];
    monthly: PayoutCollectionBucket[];
  };
}

export interface PayoutCollectionBucket {
  key: string;
  label: string;
  installmentCount: number;
  totalAmount: string;
  totalPrincipal: string;
  totalInterest: string;
  totalPenalties: string;
}

export interface PayoutEntry {
  id: number;
  loanId: number;
  amount: number;
  paymentDate: string;
  status: string;
  paymentType: string;
  principalApplied: number;
  interestApplied: number;
  penaltyApplied: number;
  paymentMethod: string | null;
  installmentNumber: number | null;
  createdBy?: {
    id?: number;
    name?: string;
    email?: string;
    role?: string;
  } | null;
  Loan?: {
    id: number;
    amount: number;
    status: string;
  };
}

export interface PayoutsReportResponse {
  success: boolean;
  count: number;
  summary: PayoutSummary;
  data: {
    payouts: PayoutEntry[];
    pagination?: {
      page: number;
      pageSize: number;
      totalItems: number;
      totalPages: number;
    };
  };
}

export interface PayoutsReportFilters {
  fromDate?: string;
  toDate?: string;
  status?: string;
  paymentType?: string;
  employeeId?: string;
}

export interface PaymentScheduleAmortizationEntry {
  installmentNumber: number;
  dueDate: string;
  openingBalance: number;
  scheduledPayment: number;
  principalComponent: number;
  interestComponent: number;
  paidPrincipal: number;
  paidInterest: number;
  paidTotal: number;
  remainingPrincipal: number;
  remainingInterest: number;
  remainingBalance: number;
  status: string;
  paidAmount: number | null;
  paidDate: string | null;
  paymentId: number | null;
}

export interface LoanScheduleInfo {
  id: number;
  customerId: number;
  customerName: string | null;
  amount: number;
  interestRate: number;
  termMonths: number;
  startDate: string | null;
  status: string;
  installmentAmount: number | null;
}

export interface PaymentScheduleSummary {
  totalPrincipal: string;
  totalInterest: string;
  totalPayment: string;
  paidInstallments: number;
  pendingInstallments: number;
  totalInstallments: number;
}

export interface PaymentScheduleResponse {
  success: boolean;
  data: {
    loan: LoanScheduleInfo;
    summary: PaymentScheduleSummary;
    schedule: PaymentScheduleAmortizationEntry[];
  };
}

export interface PaymentCalendarOverviewSummary {
  totalLoans: number;
  totalEntries: number;
  paidCount: number;
  pendingCount: number;
  overdueCount: number;
  dueTodayCount: number;
  actionableCount: number;
  totalPayableAmount: number;
  totalLateFeeAmount: number;
}

export interface PaymentCalendarOverviewAgendaItem {
  loanId: number;
  customerName: string;
  totalInstallments: number;
  installmentNumber: number;
  dueDate: string;
  status: string;
  payableAmount: number;
  scheduledPayment: number;
  lateFeeDue: number;
  daysOverdue: number;
  canPay: boolean;
  isNextPayable: boolean;
  disabledReason?: string | null;
}

export interface PaymentCalendarOverviewEntry extends PaymentCalendarOverviewAgendaItem {
  loanStatus: string;
  principalComponent: number;
  interestComponent: number;
  remainingBalance: number;
  outstandingAmount: number;
}

export interface PaymentCalendarOverviewResponse {
  success?: boolean;
  asOfDate: string;
  summary: PaymentCalendarOverviewSummary;
  agenda: PaymentCalendarOverviewAgendaItem[];
  nextAction: PaymentCalendarOverviewAgendaItem | null;
  entries: PaymentCalendarOverviewEntry[];
}
