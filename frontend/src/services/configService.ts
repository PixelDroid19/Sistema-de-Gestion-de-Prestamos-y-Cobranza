import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';

const toArray = <T,>(value: unknown): T[] => Array.isArray(value) ? value : [];

export const useConfig = () => {
  const queryClient = useQueryClient();

  const getPaymentMethods = useQuery({
    queryKey: ['config.paymentMethods'],
    queryFn: async () => {
      const { data } = await apiClient.get('/config/payment-methods');
      return data;
    },
  });

  const createPaymentMethod = useMutation({
    mutationFn: async (paymentMethodData: any) => {
      const { data } = await apiClient.post('/config/payment-methods', paymentMethodData);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config.paymentMethods'] });
    },
  });

  const updatePaymentMethod = useMutation({
    mutationFn: async ({ id, ...paymentMethodData }: any) => {
      const { data } = await apiClient.put(`/config/payment-methods/${id}`, paymentMethodData);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config.paymentMethods'] });
    },
  });

  const deletePaymentMethod = useMutation({
    mutationFn: async (id: number) => {
      const { data } = await apiClient.delete(`/config/payment-methods/${id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config.paymentMethods'] });
    },
  });

  const getSettings = useQuery({
    queryKey: ['config.settings'],
    queryFn: async () => {
      const { data } = await apiClient.get('/config/settings');
      return data;
    },
  });

  const updateSetting = useMutation({
    mutationFn: async ({ key, ...settingData }: any) => {
      const { data } = await apiClient.put(`/config/settings/${key}`, settingData);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config.settings'] });
    },
  });

  const getCatalogs = useQuery({
    queryKey: ['config.catalogs'],
    queryFn: async () => {
      const { data } = await apiClient.get('/config/catalogs');
      return data;
    },
  });

  return {
    paymentMethods: toArray(getPaymentMethods.data?.data?.paymentMethods),
    settings: toArray(getSettings.data?.data?.settings),
    catalogs: getCatalogs.data?.data?.catalogs,
    isLoading: getPaymentMethods.isLoading || getSettings.isLoading || getCatalogs.isLoading,
    createPaymentMethod,
    updatePaymentMethod,
    deletePaymentMethod,
    updateSetting,
  };
};
