import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/api/queryKeys';
import { dagService } from '@/services/dagService';

const invalidateDagWorkbenchScope = (queryClient, scopeKey) => {
  queryClient.invalidateQueries({ queryKey: queryKeys.dag.graph(scopeKey) });
  queryClient.invalidateQueries({ queryKey: queryKeys.dag.summary(scopeKey) });
};

const invalidateDagWorkbenchSummary = (queryClient, scopeKey) => {
  queryClient.invalidateQueries({ queryKey: queryKeys.dag.summary(scopeKey) });
};

export const useDagWorkbenchGraphQuery = (scopeKey, { enabled = true } = {}) => useQuery({
  queryKey: queryKeys.dag.graph(scopeKey),
  queryFn: () => dagService.loadGraph(scopeKey),
  enabled: enabled && Boolean(scopeKey),
  retry: false,
});

export const useDagWorkbenchSummaryQuery = (scopeKey, { enabled = true } = {}) => useQuery({
  queryKey: queryKeys.dag.summary(scopeKey),
  queryFn: () => dagService.getSummary(scopeKey),
  enabled: enabled && Boolean(scopeKey),
  retry: false,
});

export const useSaveDagWorkbenchGraphMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: dagService.saveGraph,
    onSuccess: (_response, variables) => invalidateDagWorkbenchScope(queryClient, variables.scopeKey),
  });
};

export const useValidateDagWorkbenchGraphMutation = () => useMutation({
  mutationFn: dagService.validateGraph,
});

export const useSimulateDagWorkbenchGraphMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: dagService.simulateGraph,
    onSuccess: (_response, variables) => invalidateDagWorkbenchSummary(queryClient, variables.scopeKey),
  });
};
