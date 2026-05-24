import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { useSessionStore } from '../store/sessionStore';

const authQueryKeys = {
  profile: ['auth.profile'] as const,
};

type LogoutSessionSnapshot = {
  accessToken?: string | null;
};

export const useAuth = () => {
  const queryClient = useQueryClient();
  const { login, logout } = useSessionStore();

  const loginMutation = useMutation({
    mutationFn: async (credentials: any) => {
      const { data } = await apiClient.post('/auth/login', credentials);
      return data;
    },
    onSuccess: (data) => {
      // Login now receives token pair: { accessToken, refreshToken, user }
      const { accessToken, refreshToken, user } = data.data;
      login({ accessToken, refreshToken, user });
      queryClient.invalidateQueries({ queryKey: authQueryKeys.profile });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async (sessionSnapshot?: LogoutSessionSnapshot) => {
      const headers = sessionSnapshot?.accessToken
        ? { Authorization: `Bearer ${sessionSnapshot.accessToken}` }
        : undefined;

      await apiClient.post('/auth/logout', undefined, headers ? { headers } : undefined);
    },
    onSuccess: () => {
      logout();
    },
    onError: () => {
      // Still logout even if the server call fails
      logout();
    },
  });

  const profileQuery = useQuery({
    queryKey: authQueryKeys.profile,
    queryFn: async () => {
      const { data } = await apiClient.get('/auth/profile');
      return data.data.user;
    },
    enabled: !!useSessionStore.getState().accessToken,
  });

  const updateProfile = useMutation({
    mutationFn: async (profileData: any) => {
      const { data } = await apiClient.put('/auth/profile', profileData);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: authQueryKeys.profile });
    }
  });

  const changePassword = useMutation({
    mutationFn: async (passwordData: any) => {
      const { data } = await apiClient.put('/auth/password', passwordData);
      return data;
    }
  });

  return {
    login: loginMutation.mutateAsync,
    logout: logoutMutation.mutateAsync,
    profile: profileQuery.data,
    isLoading: profileQuery.isLoading,
    updateProfile,
    changePassword,
  };
};
