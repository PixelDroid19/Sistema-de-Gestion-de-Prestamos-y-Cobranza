import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { userService } from '@/services/userService';
import { queryKeys } from '@/lib/api/queryKeys';
import { normalizePaginationState } from '@/lib/api/pagination';

export const useUsersQuery = ({ enabled = true, pagination } = {}) => {
  const normalizedPagination = normalizePaginationState(pagination);

  return useQuery({
    queryKey: queryKeys.users.paged(normalizedPagination),
    queryFn: () => userService.listUsers(normalizedPagination),
    enabled,
  });
};

export const useUserQuery = (userId, { enabled = true } = {}) => useQuery({
  queryKey: queryKeys.users.detail(userId),
  queryFn: () => userService.getUser(userId),
  enabled: enabled && Boolean(userId),
});

export const useUpdateUserMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, payload }) => userService.updateUser(userId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all() });
    },
  });
};

export const useDeactivateUserMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId) => userService.deactivateUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all() });
    },
  });
};

export const useReactivateUserMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId) => userService.reactivateUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all() });
    },
  });
};
