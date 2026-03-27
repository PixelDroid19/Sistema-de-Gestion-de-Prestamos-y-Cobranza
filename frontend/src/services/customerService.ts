import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';

export const useCustomers = (params?: { page?: number; limit?: number; search?: string; status?: string }) => {
  const queryClient = useQueryClient();

  const getCustomers = useQuery({
    queryKey: ['customers.list', params],
    queryFn: async () => {
      const { data } = await apiClient.get('/customers', { params });
      return data;
    },
  });

  const createCustomer = useMutation({
    mutationFn: async (customerData: any) => {
      const { data } = await apiClient.post('/customers', customerData);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers.list'] });
    },
  });

  const updateCustomer = useMutation({
    mutationFn: async ({ id, ...customerData }: any) => {
      const { data } = await apiClient.patch(`/customers/${id}`, customerData);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers.list'] });
    },
  });

  const deleteCustomer = useMutation({
    mutationFn: async (id: number) => {
      const { data } = await apiClient.delete(`/customers/${id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers.list'] });
    },
  });

  return {
    data: getCustomers.data,
    isLoading: getCustomers.isLoading,
    isError: getCustomers.isError,
    createCustomer,
    updateCustomer,
    deleteCustomer,
  };
};

export const useCustomerDocuments = (customerId: number) => {
  const queryClient = useQueryClient();

  const getDocuments = useQuery({
    queryKey: ['customers.documents', customerId],
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
      queryClient.invalidateQueries({ queryKey: ['customers.documents', customerId] });
    },
  });

  const deleteDocument = useMutation({
    mutationFn: async (documentId: number) => {
      const { data } = await apiClient.delete(`/customers/${customerId}/documents/${documentId}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers.documents', customerId] });
    },
  });

  const downloadDocumentUrl = (documentId: number) => {
    return `${apiClient.defaults.baseURL}/customers/${customerId}/documents/${documentId}/download`;
  };

  return {
    documents: getDocuments.data?.data?.documents,
    isLoading: getDocuments.isLoading,
    uploadDocument,
    deleteDocument,
    downloadDocumentUrl,
  };
};
