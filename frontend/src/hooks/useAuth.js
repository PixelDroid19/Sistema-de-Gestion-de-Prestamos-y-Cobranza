import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authService } from '@/services/authService';
import { queryKeys } from '@/lib/api/queryKeys';
import { useSessionStore } from '@/store/sessionStore';

export const useProfileQuery = ({ enabled = true } = {}) => {
  const user = useSessionStore((state) => state.user);

  return useQuery({
    queryKey: queryKeys.auth.profile(),
    queryFn: authService.getProfile,
    enabled: enabled && Boolean(user),
  });
};

export const useLoginMutation = () => {
  const login = useSessionStore((state) => state.login);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: authService.login,
    onSuccess: (response) => {
      login({ user: response.data.user, token: response.data.token });
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.profile() });
    },
  });
};

export const useRegisterMutation = () => {
  return useMutation({
    mutationFn: authService.register,
  });
};

export const useUpdateProfileMutation = () => {
  const queryClient = useQueryClient();
  const syncUser = useSessionStore((state) => state.syncUser);

  return useMutation({
    mutationFn: authService.updateProfile,
    onSuccess: (response) => {
      syncUser(response.data.user);
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.profile() });
    },
  });
};

export const useChangePasswordMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: authService.changePassword,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.password() });
    },
  });
};
