import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { useInvalidatingMutation } from './crudHooks';
import { queryKeys } from './queryKeys';

const notificationQueryKeys = {
  list: ['notifications.list'] as const,
  unreadCount: queryKeys.notifications.unreadCount,
};

const toArray = <T,>(value: unknown): T[] => Array.isArray(value) ? value : [];

export const useNotifications = () => {
  const getNotifications = useQuery({
    queryKey: notificationQueryKeys.list,
    queryFn: async () => {
      const { data } = await apiClient.get('/notifications');
      return data;
    },
  });

  const markAsRead = useInvalidatingMutation(async (id: number) => {
    const { data } = await apiClient.put(`/notifications/${id}/read`);
    return data;
  }, notificationQueryKeys.list);

  return {
    data: getNotifications.data,
    notifications: toArray(getNotifications.data?.data?.notifications),
    isLoading: getNotifications.isLoading,
    isError: getNotifications.isError,
    error: getNotifications.error,
    markAsRead,
  };
};

export const useUnreadNotificationsCount = () => {
  const getUnreadCount = useQuery({
    queryKey: notificationQueryKeys.unreadCount,
    queryFn: async () => {
      const { data } = await apiClient.get('/notifications/unread-count');
      return data;
    },
  });

  return {
    unreadCount: Number(getUnreadCount.data?.data?.count ?? getUnreadCount.data?.count ?? 0),
    isLoading: getUnreadCount.isLoading,
  };
};
