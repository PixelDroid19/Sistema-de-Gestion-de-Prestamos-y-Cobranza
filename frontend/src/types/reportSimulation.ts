export interface PayoutSummary {
  totalPayouts: number;
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

export type SimulatorPaymentMethod = 'french' | 'simple';

export interface LoanCalculationInput {
  principal: number;
  term: number;
  interestRate: number;
  paymentMethod: SimulatorPaymentMethod;
}

export interface SimulatorAmortizationEntry {
  period: number;
  payment: number;
  principal: number;
  interest: number;
  balance: number;
}

export interface LoanSimulationResult {
  monthlyPayment: number;
  totalInterest: number;
  totalPayment: number;
  principal: number;
  term: number;
  interestRate: number;
  paymentMethod: string;
  schedule: SimulatorAmortizationEntry[];
}

export interface LoanSimulationResponse {
  success: boolean;
  message: string;
  data: {
    simulation: LoanSimulationResult;
  };
}
