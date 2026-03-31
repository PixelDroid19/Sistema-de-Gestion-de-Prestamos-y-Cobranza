import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';

export const useAssociates = (params?: { page?: number; limit?: number; search?: string; status?: string }) => {
  const queryClient = useQueryClient();

  const getAssociates = useQuery({
    queryKey: ['associates.list', params],
    queryFn: async () => {
      const { data } = await apiClient.get('/associates', { params });
      return data;
    },
  });

  const createAssociate = useMutation({
    mutationFn: async (associateData: any) => {
      const { data } = await apiClient.post('/associates', associateData);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['associates.list'] });
    },
  });

  return {
    data: getAssociates.data,
    isLoading: getAssociates.isLoading,
    isError: getAssociates.isError,
    createAssociate,
  };
};

export const useAssociateDetails = (associateId: number) => {
  const queryClient = useQueryClient();

  const getPortal = useQuery({
    queryKey: ['associates.portal', associateId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/associates/${associateId}/portal`);
      return data;
    },
    enabled: !!associateId,
  });

  const getInstallments = useQuery({
    queryKey: ['associates.installments', associateId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/associates/${associateId}/installments`);
      return data;
    },
    enabled: !!associateId,
  });

  const getCalendar = useQuery({
    queryKey: ['associates.calendar', associateId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/associates/${associateId}/calendar-events`);
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
      queryClient.invalidateQueries({ queryKey: ['associates.portal', associateId] });
    },
  });

  const createDistribution = useMutation({
    mutationFn: async (distributionData: any) => {
      const { data } = await apiClient.post(`/associates/${associateId}/distributions`, distributionData);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['associates.portal', associateId] });
    },
  });

  const createReinvestment = useMutation({
    mutationFn: async (reinvestmentData: any) => {
      const { data } = await apiClient.post(`/associates/${associateId}/reinvestments`, reinvestmentData);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['associates.portal', associateId] });
    },
  });

  const payInstallment = useMutation({
    mutationFn: async (installmentNumber: number) => {
      const { data } = await apiClient.post(`/associates/${associateId}/installments/${installmentNumber}/pay`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['associates.installments', associateId] });
      queryClient.invalidateQueries({ queryKey: ['associates.calendar', associateId] });
    },
  });

  return {
    portal: getPortal.data?.data?.portal,
    installments: getInstallments.data?.data?.installments,
    calendar: getCalendar.data?.data?.calendar,
    isLoading: getPortal.isLoading,
    createContribution,
    createDistribution,
    createReinvestment,
    payInstallment,
  };
};
