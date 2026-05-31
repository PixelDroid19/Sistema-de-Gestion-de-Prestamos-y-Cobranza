import { apiClient } from '../api/client';
import { tTerm } from '../i18n/terminology';
import type { CreditCalculationInput, CreditCalculationResponse } from '../types/creditCalculation';

const assertCalculationResponse = (payload: CreditCalculationResponse): CreditCalculationResponse => {
  if (!payload?.data?.calculation) {
    throw new Error(tTerm('activeCreditSimulation.error.incompleteResponse'));
  }
  if (payload.data.calculation.calculationProfileVersionId == null) {
    throw new Error(tTerm('activeCreditSimulation.error.incompleteResponse'));
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
