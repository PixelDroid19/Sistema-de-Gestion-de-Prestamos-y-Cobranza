import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { queryKeys } from './queryKeys';
import { useCrudListQuery, useInvalidatingMutation } from './crudHooks';

export const useUsers = (params?: { page?: number; pageSize?: number; search?: string; role?: string }) => {
  const getUsers = useCrudListQuery(queryKeys.users.list(params), async () => {
    const { data } = await apiClient.get('/users', { params });
    return data;
  });

  const updateUser = useInvalidatingMutation(async ({ id, ...userData }: any) => {
    const { data } = await apiClient.put(`/users/${id}`, userData);
    return data;
  }, queryKeys.users.all);

  const deactivateUser = useInvalidatingMutation(async (id: number) => {
    const { data } = await apiClient.post(`/users/${id}/deactivate`);
    return data;
  }, queryKeys.users.all);

  const reactivateUser = useInvalidatingMutation(async (id: number) => {
    const { data } = await apiClient.post(`/users/${id}/reactivate`);
    return data;
  }, queryKeys.users.all);

  const registerWithPermissions = useInvalidatingMutation(async (userData: { name: string; email: string; password: string; role: string; permissions?: string[] }) => {
    const { data } = await apiClient.post('/auth/register-with-permissions', userData);
    return data;
  }, queryKeys.users.all);

  return {
    data: getUsers.data,
    isLoading: getUsers.isLoading,
    isError: getUsers.isError,
    updateUser,
    deactivateUser,
    reactivateUser,
    registerWithPermissions,
  };
};
