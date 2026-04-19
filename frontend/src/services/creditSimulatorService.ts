import { useMutation } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import type { SimulationResponse } from '../types/dag';

export type PaymentMethod = 'french' | 'simple';

export interface LoanCalculationInput {
  principal: number;
  term: number;
  interestRate: number;
  paymentMethod: PaymentMethod;
}

export interface LoanSimulationScheduleRow {
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
  paymentMethod: PaymentMethod;
  schedule: LoanSimulationScheduleRow[];
  graphVersionId?: number | null;
}

export interface LoanSimulationResponse {
  success: boolean;
  message: string;
  data: {
    simulation: LoanSimulationResult;
  };
}

const mapSimulationResponse = (
  payload: SimulationResponse,
  input: LoanCalculationInput,
): LoanSimulationResponse => {
  const simulation = payload.data.simulation;

  return {
    success: payload.success,
    message: payload.message,
    data: {
      simulation: {
        monthlyPayment: simulation.summary.installmentAmount,
        totalInterest: simulation.summary.totalInterest,
        totalPayment: simulation.summary.totalPayable,
        principal: input.principal,
        term: input.term,
        interestRate: input.interestRate,
        paymentMethod: input.paymentMethod,
        graphVersionId: simulation.graphVersionId ?? null,
        schedule: simulation.schedule.map((row) => ({
          period: row.installmentNumber,
          payment: row.scheduledPayment,
          principal: row.principalComponent,
          interest: row.interestComponent,
          balance: row.remainingBalance,
        })),
      },
    },
  };
};

export const useCalculateLoan = () => {
  const calculateLoan = useMutation<LoanSimulationResponse, Error, LoanCalculationInput>({
    mutationFn: async (input: LoanCalculationInput) => {
      const { data } = await apiClient.post<SimulationResponse>('/loans/simulations', {
        amount: input.principal,
        interestRate: input.interestRate,
        termMonths: input.term,
      });

      return mapSimulationResponse(data, input);
    },
  });

  return {
    calculateLoan,
    result: calculateLoan.data?.data?.simulation,
    isLoading: calculateLoan.isPending,
    isError: calculateLoan.isError,
    error: calculateLoan.error,
  };
};
