import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/api/queryKeys';
import { configService } from '@/services/configService';

const invalidateConfig = async (queryClient) => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.config.paymentMethods() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.config.settings() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.config.catalogs() }),
  ]);
};

export const usePaymentMethodsQuery = ({ enabled = true } = {}) => useQuery({
  queryKey: queryKeys.config.paymentMethods(),
  queryFn: configService.listPaymentMethods,
  enabled,
});

export const useConfigSettingsQuery = ({ enabled = true } = {}) => useQuery({
  queryKey: queryKeys.config.settings(),
  queryFn: configService.listSettings,
  enabled,
});

export const useConfigCatalogsQuery = ({ enabled = true } = {}) => useQuery({
  queryKey: queryKeys.config.catalogs(),
  queryFn: configService.listCatalogs,
  enabled,
});

export const useCreatePaymentMethodMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: configService.createPaymentMethod,
    onSuccess: () => invalidateConfig(queryClient),
  });
};

export const useUpdatePaymentMethodMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ paymentMethodId, payload }) => configService.updatePaymentMethod(paymentMethodId, payload),
    onSuccess: () => invalidateConfig(queryClient),
  });
};

export const useDeletePaymentMethodMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (paymentMethodId) => configService.deletePaymentMethod(paymentMethodId),
    onSuccess: () => invalidateConfig(queryClient),
  });
};

export const useSaveConfigSettingMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ settingKey, payload }) => configService.saveSetting(settingKey, payload),
    onSuccess: () => invalidateConfig(queryClient),
  });
};
