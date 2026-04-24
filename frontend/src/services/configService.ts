import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { queryKeys } from './queryKeys';
import { useInvalidatingMutation } from './crudHooks';

const toArray = <T,>(value: unknown): T[] => Array.isArray(value) ? value : [];

const normalizeKey = (value: string) => value
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

const mapPaymentMethod = (pm: any) => ({
  ...pm,
  name: pm.name ?? pm.label ?? '',
  type: pm.type ?? pm.key ?? 'other',
});

export const useConfig = () => {
  const getPaymentMethods = useQuery({
    queryKey: queryKeys.config.paymentMethods,
    queryFn: async () => {
      const { data } = await apiClient.get('/config/payment-methods');
      return data;
    },
  });

  const createPaymentMethod = useInvalidatingMutation(async (paymentMethodData: any) => {
    const payload = {
      label: paymentMethodData.label ?? paymentMethodData.name,
      key: paymentMethodData.key ?? normalizeKey(paymentMethodData.name ?? paymentMethodData.label ?? ''),
      description: paymentMethodData.description,
      isActive: paymentMethodData.isActive,
    };
    const { data } = await apiClient.post('/config/payment-methods', payload);
    return data;
  }, queryKeys.config.paymentMethods);

  const updatePaymentMethod = useInvalidatingMutation(async ({ id, ...paymentMethodData }: any) => {
    const { data } = await apiClient.put(`/config/payment-methods/${id}`, paymentMethodData);
    return data;
  }, queryKeys.config.paymentMethods);

  const deletePaymentMethod = useInvalidatingMutation(async (id: number) => {
    const { data } = await apiClient.delete(`/config/payment-methods/${id}`);
    return data;
  }, queryKeys.config.paymentMethods);

  const getSettings = useQuery({
    queryKey: queryKeys.config.settings,
    queryFn: async () => {
      const { data } = await apiClient.get('/config/settings');
      return data;
    },
  });

  const updateSetting = useInvalidatingMutation(async ({ key, ...settingData }: any) => {
    const { data } = await apiClient.put(`/config/settings/${key}`, settingData);
    return data;
  }, queryKeys.config.settings);

  const getCatalogs = useQuery({
    queryKey: queryKeys.config.catalogs,
    queryFn: async () => {
      const { data } = await apiClient.get('/config/catalogs');
      return data;
    },
  });

  const getRoles = useQuery({
    queryKey: queryKeys.config.roles,
    queryFn: async () => {
      const { data } = await apiClient.get('/config/roles');
      return data;
    },
  });

  return {
    paymentMethods: toArray(getPaymentMethods.data?.data?.paymentMethods).map(mapPaymentMethod),
    settings: toArray(getSettings.data?.data?.settings),
    catalogs: getCatalogs.data?.data?.catalogs,
    roles: toArray(getRoles.data?.data?.roles),
    isLoading: getPaymentMethods.isLoading || getSettings.isLoading || getCatalogs.isLoading || getRoles.isLoading,
    createPaymentMethod,
    updatePaymentMethod,
    deletePaymentMethod,
    updateSetting,
  };
};
