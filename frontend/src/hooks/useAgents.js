import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { agentService } from '@/services/agentService';
import { queryKeys } from '@/lib/api/queryKeys';

export const useAgentsQuery = ({ enabled = true } = {}) => useQuery({
  queryKey: queryKeys.agents.all(),
  queryFn: agentService.listAgents,
  enabled,
});

export const useCreateAgentMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: agentService.createAgent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.all() });
    },
  });
};
