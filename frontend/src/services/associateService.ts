import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { queryKeys, type AssociateCalendarFilters } from './queryKeys';
import { useCrudListQuery, useInvalidatingMutation } from './crudHooks';

export type AssociateInstallmentPaymentPayload = {
  installmentNumber: number;
  paymentDate?: string;
  paymentMethod?: string;
  notes?: string;
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
      queryClient.invalidateQueries({ queryKey: queryKeys.associates.financialDetails(associateId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.associates.calendar(associateId) });
    },
  });

  const createDistribution = useMutation({
    mutationFn: async (distributionData: any) => {
      const { data } = await apiClient.post(`/associates/${associateId}/distributions`, distributionData);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.associates.financialDetails(associateId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.associates.calendar(associateId) });
    },
  });

  const createReinvestment = useMutation({
    mutationFn: async (reinvestmentData: any) => {
      const { data } = await apiClient.post(`/associates/${associateId}/reinvestments`, reinvestmentData);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.associates.financialDetails(associateId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.associates.calendar(associateId) });
    },
  });

  const payInstallment = useMutation({
    mutationFn: async (payment: number | AssociateInstallmentPaymentPayload) => {
      const paymentPayload = typeof payment === 'number'
        ? { installmentNumber: payment }
        : payment;
      const {
        installmentNumber,
        paymentDate,
        paymentMethod,
        notes,
      } = paymentPayload;
      const { data } = await apiClient.post(
        `/associates/${associateId}/installments/${installmentNumber}/pay`,
        {
          ...(paymentDate ? { paymentDate } : {}),
          ...(paymentMethod ? { paymentMethod } : {}),
          ...(notes ? { notes } : {}),
        },
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.associates.installments(associateId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.associates.calendar(associateId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.associates.financialDetails(associateId) });
    },
  });

  const details = getFinancialDetails.data?.data?.details;

  return {
    details,
    installments: getInstallments.data?.data?.installments,
    contributions: details?.contributions,
    calendar: getCalendar.data?.data?.calendar,
    isLoading: getFinancialDetails.isLoading || getInstallments.isLoading || getCalendar.isLoading,
    createContribution,
    createDistribution,
    createReinvestment,
    payInstallment,
  };
};
