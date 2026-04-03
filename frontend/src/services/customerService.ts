import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { API_BASE_URL, apiClient } from '../api/client';
import { queryKeys } from './queryKeys';
import { useCrudListQuery, useInvalidatingMutation } from './crudHooks';

export const useCustomers = (params?: { page?: number; pageSize?: number; search?: string; status?: string }) => {
  const getCustomers = useCrudListQuery(queryKeys.customers.list(params), async () => {
    const { data } = await apiClient.get('/customers', { params });
    return data;
  });

  const createCustomer = useInvalidatingMutation(async (customerData: any) => {
    const { data } = await apiClient.post('/customers', customerData);
    return data;
  }, queryKeys.customers.all);

  const updateCustomer = useInvalidatingMutation(async ({ id, ...customerData }: any) => {
    const { data } = await apiClient.patch(`/customers/${id}`, customerData);
    return data;
  }, queryKeys.customers.all);

  const deleteCustomer = useInvalidatingMutation(async (id: number) => {
    const { data } = await apiClient.delete(`/customers/${id}`);
    return data;
  }, queryKeys.customers.all);

  const restoreCustomer = useInvalidatingMutation(async (id: number) => {
    const { data } = await apiClient.patch(`/customers/${id}/restore`);
    return data;
  }, queryKeys.customers.all);

  return {
    data: getCustomers.data,
    isLoading: getCustomers.isLoading,
    isError: getCustomers.isError,
    createCustomer,
    updateCustomer,
    deleteCustomer,
    restoreCustomer,
  };
};

export const useCustomerDocuments = (customerId: number) => {
  const queryClient = useQueryClient();

  const getDocuments = useQuery({
    queryKey: queryKeys.customers.documents(customerId),
    queryFn: async () => {
      const { data } = await apiClient.get(`/customers/${customerId}/documents`);
      return data;
    },
    enabled: !!customerId,
  });

  const uploadDocument = useMutation({
    mutationFn: async ({ file, metadata }: { file: File, metadata?: any }) => {
      const formData = new FormData();
      formData.append('file', file);
      if (metadata) {
        Object.keys(metadata).forEach(key => formData.append(key, metadata[key]));
      }
      const { data } = await apiClient.post(`/customers/${customerId}/documents`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.documents(customerId) });
    },
  });

  const deleteDocument = useMutation({
    mutationFn: async (documentId: number) => {
      const { data } = await apiClient.delete(`/customers/${customerId}/documents/${documentId}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.documents(customerId) });
    },
  });

  const downloadDocumentUrl = (documentId: number) => {
    return `${API_BASE_URL}/customers/${customerId}/documents/${documentId}/download`;
  };

  return {
    documents: getDocuments.data?.data?.documents,
    isLoading: getDocuments.isLoading,
    uploadDocument,
    deleteDocument,
    downloadDocumentUrl,
  };
};
