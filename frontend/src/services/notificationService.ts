import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';

const toArray = <T,>(value: unknown): T[] => Array.isArray(value) ? value : [];

export const useNotifications = () => {
  const queryClient = useQueryClient();

  const getNotifications = useQuery({
    queryKey: ['notifications.list'],
    queryFn: async () => {
      const { data } = await apiClient.get('/notifications');
      return data;
    },
  });

  const markAsRead = useMutation({
    mutationFn: async (id: number) => {
      const { data } = await apiClient.put(`/notifications/${id}/read`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications.list'] });
    },
  });

  return {
    data: getNotifications.data,
    notifications: toArray(getNotifications.data?.data?.notifications),
    isLoading: getNotifications.isLoading,
    isError: getNotifications.isError,
    error: getNotifications.error,
    markAsRead,
  };
};
