import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { customerService } from '@/services/customerService';
import { reportService } from '@/services/reportService';
import { queryKeys } from '@/lib/api/queryKeys';

export const useCustomersQuery = ({ enabled = true, pagination } = {}) => useQuery({
  queryKey: queryKeys.customers.paged(pagination || {}),
  queryFn: () => customerService.listCustomers(pagination),
  enabled,
});

export const useCustomerDocumentsQuery = (customerId, { enabled = true } = {}) => useQuery({
  queryKey: queryKeys.customers.documents(customerId),
  queryFn: () => customerService.listDocuments(customerId),
  enabled: enabled && Boolean(customerId),
});

export const useCustomerHistoryQuery = (customerId, { enabled = true } = {}) => useQuery({
  queryKey: queryKeys.customers.history(customerId),
  queryFn: () => reportService.getCustomerHistory(customerId),
  enabled: enabled && Boolean(customerId),
});

export const useCreateCustomerMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: customerService.createCustomer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.all() });
    },
  });
};

export const useUpdateCustomerMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ customerId, payload }) => customerService.updateCustomer(customerId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.loans.all('all') });
    },
  });
};

export const useDeleteCustomerMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (customerId) => customerService.deleteCustomer(customerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.loans.all('all') });
    },
  });
};

export const useUploadCustomerDocumentMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ customerId, formData }) => customerService.uploadDocument(customerId, formData),
    onSuccess: (_response, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.documents(variables.customerId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.history(variables.customerId) });
    },
  });
};

export const useDeleteCustomerDocumentMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ customerId, documentId }) => customerService.deleteDocument(customerId, documentId),
    onSuccess: (_response, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.documents(variables.customerId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.history(variables.customerId) });
    },
  });
};
