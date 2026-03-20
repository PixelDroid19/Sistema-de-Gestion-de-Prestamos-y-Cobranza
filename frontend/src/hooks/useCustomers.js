import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { customerService } from '../services/customerService';
import { reportService } from '../services/reportService';
import { queryKeys } from '../lib/api/queryKeys';

export const useCustomersQuery = ({ enabled = true } = {}) => useQuery({
  queryKey: queryKeys.customers.all(),
  queryFn: customerService.listCustomers,
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
