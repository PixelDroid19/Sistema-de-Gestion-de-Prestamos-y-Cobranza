import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { queryKeys, type AssociateCalendarFilters, type AssociateMovementFilters, type AssociateTrackingFilters } from './queryKeys';
import { useCrudListQuery, useInvalidatingMutation } from './crudHooks';

export type AssociateInstallmentPaymentPayload = {
  installmentNumber: number;
  paymentDate: string;
  paymentMethod: string;
};

const downloadAssociateExport = async ({
  search,
  status,
  fromDate,
  toDate,
  format = 'xlsx',
}: { search?: string; status?: string; fromDate?: string; toDate?: string; format?: 'xlsx' | 'pdf' } = {}): Promise<void> => {
  const response = await apiClient.get('/associates/export', {
    responseType: 'blob',
    params: {
      search,
      status,
      ...(fromDate ? { fromDate } : {}),
      ...(toDate ? { toDate } : {}),
      ...(format === 'pdf' ? { format } : {}),
    },
  });

  const blob = new Blob([response.data], {
    type: format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const objectUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = `associate-movements.${format}`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(objectUrl);
};

export const exportAssociatesExcel = downloadAssociateExport;

export const exportAssociateFinancialSummary = async (associateId: number): Promise<void> => {
  const response = await apiClient.get(`/associates/${associateId}/export`, {
    responseType: 'blob',
    params: { format: 'xlsx' },
  });

  const blob = new Blob([response.data], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const objectUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = `associate-${associateId}-financial-summary.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(objectUrl);
};

export const useAssociates = (
  params?: { page?: number; pageSize?: number; search?: string; status?: string },
  options?: { enabled?: boolean },
) => {
  const getAssociates = useCrudListQuery(queryKeys.associates.list(params), async () => {
    const { data } = await apiClient.get('/associates', { params });
    return data;
  }, { enabled: options?.enabled });

  const createAssociate = useInvalidatingMutation(async (associateData: any) => {
    const { data } = await apiClient.post('/associates', associateData);
    return data;
  }, queryKeys.associates.all);

  const updateAssociate = useInvalidatingMutation(async ({ id, ...associateData }: any) => {
    const { data } = await apiClient.patch(`/associates/${id}`, associateData);
    return data;
  }, queryKeys.associates.all);

  const deleteAssociate = useInvalidatingMutation(async (id: number) => {
    const { data } = await apiClient.delete(`/associates/${id}`);
    return data;
  }, queryKeys.associates.all);

  const restoreAssociate = useInvalidatingMutation(async (id: number) => {
    const { data } = await apiClient.patch(`/associates/${id}`, { status: 'active' });
    return data;
  }, queryKeys.associates.all);

  return {
    data: getAssociates.data,
    isLoading: getAssociates.isLoading,
    isError: getAssociates.isError,
    createAssociate,
    updateAssociate,
    deleteAssociate,
    restoreAssociate,
  };
};

export const useAssociateById = (associateId: number) => {
  return useQuery({
    queryKey: queryKeys.associates.detail(associateId),
    queryFn: async () => {
      const { data } = await apiClient.get(`/associates/${associateId}`);
      return data;
    },
    enabled: Number.isFinite(associateId) && associateId > 0,
  });
};

export const useAssociateTracking = (
  filters?: AssociateTrackingFilters,
  options?: { enabled?: boolean },
) => useQuery({
  queryKey: queryKeys.associates.tracking(filters),
  queryFn: async () => {
    const { data } = await apiClient.get('/associates/tracking', { params: filters });
    return data;
  },
  enabled: options?.enabled ?? true,
});

export const useAssociateMovements = (filters?: AssociateMovementFilters, options?: { enabled?: boolean }) => useQuery({
  queryKey: queryKeys.associates.movements(filters),
  queryFn: async () => {
    const { data } = await apiClient.get('/associates/movements', { params: filters });
    return data;
  },
  enabled: options?.enabled ?? true,
});

const normalizeCalendarFilters = (filters?: AssociateCalendarFilters): AssociateCalendarFilters => ({
  ...(filters?.startDate ? { startDate: filters.startDate } : {}),
  ...(filters?.endDate ? { endDate: filters.endDate } : {}),
});

export const useAssociateDetails = (associateId: number, calendarFilters?: AssociateCalendarFilters) => {
  const queryClient = useQueryClient();
  const normalizedCalendarFilters = normalizeCalendarFilters(calendarFilters);

  const getFinancialDetails = useQuery({
    queryKey: queryKeys.associates.financialDetails(associateId),
    queryFn: async () => {
      const { data } = await apiClient.get(`/associates/${associateId}/financial-details`);
      return data;
    },
    enabled: !!associateId,
  });

  const getInstallments = useQuery({
    queryKey: queryKeys.associates.installments(associateId),
    queryFn: async () => {
      const { data } = await apiClient.get(`/associates/${associateId}/installments`);
      return data;
    },
    enabled: !!associateId,
  });

  const getCalendar = useQuery({
    queryKey: queryKeys.associates.calendar(associateId, normalizedCalendarFilters),
    queryFn: async () => {
      const { data } = await apiClient.get(`/associates/${associateId}/calendar-events`, {
        params: normalizedCalendarFilters,
      });
      return data;
    },
    enabled: !!associateId,
  });

  const createContribution = useMutation({
    mutationFn: async (contributionData: any) => {
      const { data } = await apiClient.post(`/associates/${associateId}/contributions`, contributionData);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.associates.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.associates.financialDetails(associateId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.associates.installments(associateId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.associates.calendar(associateId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.associates.tracking() });
    },
  });

  const configureInvestmentTerm = useMutation({
    mutationFn: async (payload: { investmentTermMonths: number }) => {
      const { data } = await apiClient.post(`/associates/${associateId}/investment-term`, payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.associates.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.associates.detail(associateId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.associates.financialDetails(associateId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.associates.installments(associateId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.associates.calendar(associateId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.associates.tracking() });
    },
  });

  const createManualProfitabilityPayment = useMutation({
    mutationFn: async (distributionData: any) => {
      const { data } = await apiClient.post(`/associates/${associateId}/manual-profitability-payments`, distributionData);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.associates.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.associates.financialDetails(associateId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.associates.calendar(associateId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.associates.tracking() });
    },
  });

  const createCapitalReturn = useMutation({
    mutationFn: async (capitalReturnData: any) => {
      const { data } = await apiClient.post(`/associates/${associateId}/capital-returns`, capitalReturnData);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.associates.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.associates.financialDetails(associateId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.associates.installments(associateId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.associates.calendar(associateId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.associates.tracking() });
    },
  });

  const createReinvestment = useMutation({
    mutationFn: async (reinvestmentData: any) => {
      const { data } = await apiClient.post(`/associates/${associateId}/reinvestments`, reinvestmentData);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.associates.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.associates.financialDetails(associateId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.associates.installments(associateId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.associates.calendar(associateId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.associates.tracking() });
    },
  });

  const payInstallment = useMutation({
    mutationFn: async (payment: AssociateInstallmentPaymentPayload) => {
      const installmentNumber = Number(payment.installmentNumber);
      const paymentDate = String(payment.paymentDate || '').trim();
      const paymentMethod = String(payment.paymentMethod || '').trim();
      if (!Number.isFinite(installmentNumber) || installmentNumber <= 0) {
        throw new Error('installmentNumber is required');
      }
      if (!paymentDate) {
        throw new Error('paymentDate is required');
      }
      if (!paymentMethod) {
        throw new Error('paymentMethod is required');
      }
      const { data } = await apiClient.post(
        `/associates/${associateId}/installments/${installmentNumber}/pay`,
        {
          paymentDate,
          paymentMethod,
        },
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.associates.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.associates.installments(associateId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.associates.calendar(associateId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.associates.financialDetails(associateId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.associates.tracking() });
    },
  });

  const financialDetailsPayload = getFinancialDetails.data?.data;
  const details = financialDetailsPayload?.details;
  const installmentsPayload = getInstallments.data?.data;
  const calendarPayload = getCalendar.data?.data;

  return {
    details,
    installments: installmentsPayload?.installments,
    contributions: details?.contributions,
    calendar: calendarPayload?.calendar,
    isLoading: getFinancialDetails.isLoading || getInstallments.isLoading || getCalendar.isLoading,
    createContribution,
    configureInvestmentTerm,
    createManualProfitabilityPayment,
    createCapitalReturn,
    createReinvestment,
    payInstallment,
  };
};
