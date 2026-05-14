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

const normalizePaymentMethodType = (value: unknown) => {
  const normalizedValue = String(value || 'other').trim().toLowerCase();
  return ['bank_transfer', 'cash', 'card', 'other'].includes(normalizedValue)
    ? normalizedValue
    : 'other';
};

const inferRequiresReference = (type: string) => type === 'bank_transfer' || type === 'card';

const mapPaymentMethod = (pm: any) => ({
  ...pm,
  name: pm.name ?? pm.label ?? '',
  type: normalizePaymentMethodType(pm.type ?? pm.metadata?.type ?? pm.key),
});

type UseConfigOptions = {
  enabled?: boolean;
};

export const useConfig = ({ enabled = true }: UseConfigOptions = {}) => {
  const getPaymentMethods = useQuery({
    queryKey: queryKeys.config.paymentMethods,
    queryFn: async () => {
      const { data } = await apiClient.get('/config/payment-methods');
      return data;
    },
    enabled,
  });

  const getRatePolicies = useQuery({
    queryKey: queryKeys.config.ratePolicies,
    queryFn: async () => {
      const { data } = await apiClient.get('/config/rate-policies');
      return data;
    },
    enabled,
  });

  const getLateFeePolicies = useQuery({
    queryKey: queryKeys.config.lateFeePolicies,
    queryFn: async () => {
      const { data } = await apiClient.get('/config/late-fee-policies');
      return data;
    },
    enabled,
  });

  const createPaymentMethod = useInvalidatingMutation(async (paymentMethodData: any) => {
    const normalizedType = normalizePaymentMethodType(paymentMethodData.type);
    const payload = {
      label: paymentMethodData.label ?? paymentMethodData.name,
      key: paymentMethodData.key ?? normalizeKey(paymentMethodData.name ?? paymentMethodData.label ?? ''),
      description: paymentMethodData.description,
      isActive: paymentMethodData.isActive,
      type: normalizedType,
      requiresReference: paymentMethodData.requiresReference ?? inferRequiresReference(normalizedType),
    };
    const { data } = await apiClient.post('/config/payment-methods', payload);
    return data;
  }, queryKeys.config.paymentMethods);

  const updatePaymentMethod = useInvalidatingMutation(async ({ id, ...paymentMethodData }: any) => {
    const normalizedType = paymentMethodData.type !== undefined
      ? normalizePaymentMethodType(paymentMethodData.type)
      : undefined;
    const { data } = await apiClient.put(`/config/payment-methods/${id}`, {
      ...paymentMethodData,
      ...(normalizedType ? { type: normalizedType } : {}),
      ...(normalizedType && paymentMethodData.requiresReference === undefined
        ? { requiresReference: inferRequiresReference(normalizedType) }
        : {}),
    });
    return data;
  }, queryKeys.config.paymentMethods);

  const deletePaymentMethod = useInvalidatingMutation(async (id: number) => {
    const { data } = await apiClient.delete(`/config/payment-methods/${id}`);
    return data;
  }, queryKeys.config.paymentMethods);

  const createRatePolicy = useInvalidatingMutation(async (payload: any) => {
    const { data } = await apiClient.post('/config/rate-policies', {
      ...payload,
      key: payload.key ?? normalizeKey(payload.label ?? ''),
    });
    return data;
  }, queryKeys.config.ratePolicies);

  const updateRatePolicy = useInvalidatingMutation(async ({ id, ...payload }: any) => {
    const { data } = await apiClient.put(`/config/rate-policies/${id}`, payload);
    return data;
  }, queryKeys.config.ratePolicies);

  const deleteRatePolicy = useInvalidatingMutation(async (id: number) => {
    const { data } = await apiClient.delete(`/config/rate-policies/${id}`);
    return data;
  }, queryKeys.config.ratePolicies);

  const createLateFeePolicy = useInvalidatingMutation(async (payload: any) => {
    const { data } = await apiClient.post('/config/late-fee-policies', {
      ...payload,
      key: payload.key ?? normalizeKey(payload.label ?? ''),
    });
    return data;
  }, queryKeys.config.lateFeePolicies);

  const updateLateFeePolicy = useInvalidatingMutation(async ({ id, ...payload }: any) => {
    const { data } = await apiClient.put(`/config/late-fee-policies/${id}`, payload);
    return data;
  }, queryKeys.config.lateFeePolicies);

  const deleteLateFeePolicy = useInvalidatingMutation(async (id: number) => {
    const { data } = await apiClient.delete(`/config/late-fee-policies/${id}`);
    return data;
  }, queryKeys.config.lateFeePolicies);

  return {
    paymentMethods: toArray(getPaymentMethods.data?.data?.paymentMethods).map(mapPaymentMethod),
    ratePolicies: toArray(getRatePolicies.data?.data?.policies),
    lateFeePolicies: toArray(getLateFeePolicies.data?.data?.policies),
    isLoading: getPaymentMethods.isLoading || getRatePolicies.isLoading || getLateFeePolicies.isLoading,
    isError: getPaymentMethods.isError || getRatePolicies.isError || getLateFeePolicies.isError,
    createPaymentMethod,
    updatePaymentMethod,
    deletePaymentMethod,
    createRatePolicy,
    updateRatePolicy,
    deleteRatePolicy,
    createLateFeePolicy,
    updateLateFeePolicy,
    deleteLateFeePolicy,
  };
};
