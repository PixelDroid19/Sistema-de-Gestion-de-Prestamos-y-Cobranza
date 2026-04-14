import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';

type QueryFactory<TData> = () => Promise<TData>;
type MutationFactory<TVariables, TResult> = (variables: TVariables) => Promise<TResult>;

export const useCrudListQuery = <TData>(
  queryKey: QueryKey,
  queryFn: QueryFactory<TData>,
  options?: { enabled?: boolean },
) => {
  return useQuery({
    queryKey,
    queryFn,
    enabled: options?.enabled,
  });
};

export const useInvalidatingMutation = <TVariables, TResult>(
  mutationFn: MutationFactory<TVariables, TResult>,
  invalidate: QueryKey | QueryKey[],
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: async () => {
      const keys = Array.isArray(invalidate[0]) ? (invalidate as QueryKey[]) : [invalidate as QueryKey];
      await Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
    },
  });
};
