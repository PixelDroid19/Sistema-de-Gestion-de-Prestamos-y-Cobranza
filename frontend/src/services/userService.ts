import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';

export const useUsers = (params?: { page?: number; limit?: number; search?: string; role?: string }) => {
  const queryClient = useQueryClient();

  const getUsers = useQuery({
    queryKey: ['users.list', params],
    queryFn: async () => {
      const { data } = await apiClient.get('/users', { params });
      return data;
    },
  });

  const createUser = useMutation({
    mutationFn: async (userData: any) => {
      const { data } = await apiClient.post('/users', userData);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users.list'] });
    },
  });

  const updateUser = useMutation({
    mutationFn: async ({ id, ...userData }: any) => {
      const { data } = await apiClient.put(`/users/${id}`, userData);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users.list'] });
    },
  });

  const deactivateUser = useMutation({
    mutationFn: async (id: number) => {
      const { data } = await apiClient.post(`/users/${id}/deactivate`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users.list'] });
    },
  });

  const reactivateUser = useMutation({
    mutationFn: async (id: number) => {
      const { data } = await apiClient.post(`/users/${id}/reactivate`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users.list'] });
    },
  });

  return {
    data: getUsers.data,
    isLoading: getUsers.isLoading,
    isError: getUsers.isError,
    updateUser,
    deactivateUser,
    reactivateUser,
  };
};
