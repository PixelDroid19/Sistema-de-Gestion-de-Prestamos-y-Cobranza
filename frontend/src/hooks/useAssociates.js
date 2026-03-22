import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { associateService } from '@/services/associateService';
import { queryKeys } from '@/lib/api/queryKeys';
import { normalizePaginationState } from '@/lib/api/pagination';

export const useAssociatesQuery = ({ enabled = true, pagination } = {}) => {
  const normalizedPagination = normalizePaginationState(pagination);

  return useQuery({
    queryKey: queryKeys.associates.paged(normalizedPagination),
    queryFn: () => associateService.listAssociates(normalizedPagination),
    enabled,
  });
};

export const useAssociatePortalQuery = (associateId, { enabled = true } = {}) => useQuery({
  queryKey: queryKeys.associates.portal(associateId),
  queryFn: () => associateService.getAssociatePortal(associateId),
  enabled,
});

const invalidateAssociateScope = (queryClient, associateId) => {
  queryClient.invalidateQueries({ queryKey: queryKeys.associates.all() });
  queryClient.invalidateQueries({ queryKey: queryKeys.associates.portal(associateId) });
  queryClient.invalidateQueries({ queryKey: queryKeys.associates.profitability(associateId) });
};

export const useCreateAssociateMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: associateService.createAssociate,
    onSuccess: () => invalidateAssociateScope(queryClient),
  });
};

export const useUpdateAssociateMutation = (associateId) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) => associateService.updateAssociate(associateId, payload),
    onSuccess: () => invalidateAssociateScope(queryClient, associateId),
  });
};

export const useDeleteAssociateMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: associateService.deleteAssociate,
    onSuccess: () => invalidateAssociateScope(queryClient),
  });
};

export const useCreateAssociateContributionMutation = (associateId) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) => associateService.createContribution(associateId, payload),
    onSuccess: () => invalidateAssociateScope(queryClient, associateId),
  });
};

export const useCreateAssociateDistributionMutation = (associateId) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) => associateService.createDistribution(associateId, payload),
    onSuccess: () => invalidateAssociateScope(queryClient, associateId),
  });
};

export const useCreateAssociateReinvestmentMutation = (associateId) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) => associateService.createReinvestment(associateId, payload),
    onSuccess: () => invalidateAssociateScope(queryClient, associateId),
  });
};

export const useCreateProportionalDistributionMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ payload, idempotencyKey }) => associateService.createProportionalDistribution(payload, idempotencyKey),
    onSuccess: () => invalidateAssociateScope(queryClient),
  });
};
