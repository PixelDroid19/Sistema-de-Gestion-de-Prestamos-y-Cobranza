export type LateFeeMode = 'NONE' | 'SIMPLE' | 'COMPOUND' | 'FLAT' | 'TIERED';
export type InstallmentStatus = 'pending' | 'paid' | 'partial' | 'overdue' | 'annulled';
export type CalculationMethodKey = 'FRENCH' | 'SIMPLE' | 'COMPOUND';

export interface CreditCalculationInput {
  amount: number;
  interestRate: number;
  termMonths: number;
  startDate?: string;
  lateFeeMode?: LateFeeMode;
  annualLateFeeRate?: number;
  rateSource?: 'policy' | 'manual';
  lateFeeSource?: 'policy' | 'manual';
  calculationMethod?: CalculationMethodKey;
}

export interface NextInstallment {
  installmentNumber: number;
  dueDate: string;
  scheduledPayment: number;
  remainingPrincipal: number;
  remainingInterest: number;
}

export interface CreditCalculationSummary {
  installmentAmount: number;
  totalPrincipal: number;
  totalInterest: number;
  totalPayable: number;
  outstandingBalance: number;
  outstandingPrincipal: number;
  outstandingInterest: number;
  outstandingInstallments: number;
  nextInstallment: NextInstallment | null;
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
  status: InstallmentStatus;
}

export interface CreditCalculationResult {
  calculationVersionId: number;
  calculationProfileVersionId: number;
  method: CalculationMethodKey;
  lateFeeMode: LateFeeMode;
  inputs: CreditCalculationInput;
  policySnapshot: Record<string, unknown> | null;
  summary: CreditCalculationSummary;
  schedule: AmortizationRow[];
  explanation?: Record<string, unknown> | null;
}

export interface CreditCalculationResponse {
  success: boolean;
  message: string;
  data: {
    calculation: CreditCalculationResult;
  };
}
