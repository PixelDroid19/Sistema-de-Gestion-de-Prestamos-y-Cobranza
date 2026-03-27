import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { useSessionStore } from '../store/sessionStore';

export const useAuth = () => {
  const queryClient = useQueryClient();
  const { login, logout } = useSessionStore();

  const loginMutation = useMutation({
    mutationFn: async (credentials: any) => {
      const { data } = await apiClient.post('/auth/login', credentials);
      return data;
    },
    onSuccess: (data) => {
      login(data.data.token, data.data.user);
      queryClient.invalidateQueries({ queryKey: ['auth.profile'] });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (userData: any) => {
      const { data } = await apiClient.post('/auth/register', userData);
      return data;
    },
    onSuccess: (data) => {
      login(data.data.token, data.data.user);
    },
  });

  const profileQuery = useQuery({
    queryKey: ['auth.profile'],
    queryFn: async () => {
      const { data } = await apiClient.get('/auth/profile');
      return data.data.user;
    },
    enabled: !!useSessionStore.getState().token,
  });

  const updateProfile = useMutation({
    mutationFn: async (profileData: any) => {
      const { data } = await apiClient.put('/auth/profile', profileData);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth.profile'] });
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
    register: registerMutation.mutateAsync,
    logout,
    profile: profileQuery.data,
    isLoading: profileQuery.isLoading,
    updateProfile,
    changePassword
  };
};
