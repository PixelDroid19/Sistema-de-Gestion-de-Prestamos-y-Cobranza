import { useMutation } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import type {
  LoanCalculationInput,
  LoanSimulationResponse,
  SimulatorPaymentMethod as PaymentMethod,
} from '../types/reportSimulation';

export type { PaymentMethod };

export const useCalculateLoan = () => {
  const calculateLoan = useMutation<LoanSimulationResponse, Error, LoanCalculationInput>({
    mutationFn: async (input: LoanCalculationInput) => {
      const { data } = await apiClient.post('/credit-simulator/calculate', input);
      return data;
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
