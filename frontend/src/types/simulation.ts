export interface SimulationSummary {
  installmentAmount: number;
  totalPrincipal: number;
  totalInterest: number;
  totalPayable: number;
  outstandingBalance: number;
  outstandingPrincipal: number;
  outstandingInterest: number;
  outstandingInstallments: number;
  nextInstallment: {
    installmentNumber: number;
    dueDate: string;
    scheduledPayment: number;
    remainingPrincipal: number;
    remainingInterest: number;
  } | null;
}

export interface AmortizationRow {
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
  status: 'pending' | 'paid' | 'partial' | 'overdue' | 'annulled';
}

export interface SimulationResult {
  lateFeeMode: string;
  summary: SimulationSummary;
  schedule: AmortizationRow[];
}

export interface SimulationInput {
  amount: number;
  interestRate: number;
  termMonths: number;
  startDate?: string;
  lateFeeMode?: string;
}
