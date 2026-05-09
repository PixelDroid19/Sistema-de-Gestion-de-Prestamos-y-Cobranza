import { apiClient } from '../api/client';
import type { CreditCalculationInput, CreditCalculationResponse } from '../types/creditCalculation';

const assertCalculationResponse = (payload: CreditCalculationResponse): CreditCalculationResponse => {
  if (!payload?.data?.calculation) {
    throw new Error('Credit calculation response is missing data.calculation');
  }
  if (payload.data.calculation.calculationProfileVersionId == null) {
    throw new Error('Credit calculation response is missing data.calculation.calculationProfileVersionId');
  }

  return payload;
};

export const creditCalculationService = {
  async calculate(input: CreditCalculationInput): Promise<CreditCalculationResponse> {
    const { data } = await apiClient.post<CreditCalculationResponse>('/loans/calculations', input);
    return assertCalculationResponse(data);
  },
};

export default creditCalculationService;
