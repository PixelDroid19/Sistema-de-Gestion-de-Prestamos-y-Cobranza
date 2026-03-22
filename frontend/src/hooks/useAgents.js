import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { agentService } from '@/services/agentService';
import { queryKeys } from '@/lib/api/queryKeys';
import { normalizePaginationState } from '@/lib/api/pagination';

export const useAgentsQuery = ({ enabled = true, pagination } = {}) => {
  const normalizedPagination = normalizePaginationState(pagination);

  return useQuery({
    queryKey: queryKeys.agents.paged(normalizedPagination),
    queryFn: () => agentService.listAgents(normalizedPagination),
    enabled,
  });
};

export const useCreateAgentMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: agentService.createAgent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.all() });
    },
  });
};
