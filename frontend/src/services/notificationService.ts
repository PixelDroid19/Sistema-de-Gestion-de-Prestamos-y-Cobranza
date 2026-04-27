import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { useInvalidatingMutation } from './crudHooks';
import { queryKeys } from './queryKeys';

const notificationQueryKeys = {
  list: queryKeys.notifications.list,
  unreadCount: queryKeys.notifications.unreadCount,
};

const toArray = <T,>(value: unknown): T[] => Array.isArray(value) ? value : [];

const toPositiveInteger = (value: unknown): number | null => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
};

const getNotificationTitle = (notification: any) => {
  if (notification?.title) return notification.title;

  const labels: Record<string, string> = {
    loan_assignment: 'Asignación de crédito',
    loan_reminder: 'Recordatorio de cuota',
    promise_status: 'Estado de compromiso',
  };

  return labels[String(notification?.type || '')] || 'Notificación';
};

export const resolveNotificationDestination = (notification: any): string | null => {
  const payload = notification?.data ?? notification?.payload ?? {};
  const loanId = toPositiveInteger(payload?.loanId ?? notification?.loanId);
  if (loanId) {
    return `/credits/${loanId}`;
  }

  const customerId = toPositiveInteger(payload?.customerId ?? notification?.customerId);
  if (customerId) {
    return `/customers/${customerId}`;
  }

  const associateId = toPositiveInteger(payload?.associateId ?? notification?.associateId);
  if (associateId) {
    return `/associates/${associateId}`;
  }

  return null;
};

const normalizeNotification = (notification: any) => ({
  ...notification,
  title: getNotificationTitle(notification),
  read: Boolean(notification?.read ?? notification?.isRead),
  isRead: Boolean(notification?.isRead ?? notification?.read),
  destination: resolveNotificationDestination(notification),
});

export const useNotifications = () => {
  const getNotifications = useQuery({
    queryKey: notificationQueryKeys.list,
    queryFn: async () => {
      const { data } = await apiClient.get('/notifications');
      return data;
    },
  });

  const invalidateNotifications = [notificationQueryKeys.list, notificationQueryKeys.unreadCount];

  const markAsRead = useInvalidatingMutation(async (id: number) => {
    const { data } = await apiClient.put(`/notifications/${id}/read`);
    return data;
  }, invalidateNotifications);

  const markAllAsRead = useInvalidatingMutation(async () => {
    const { data } = await apiClient.patch('/notifications/mark-all-read');
    return data;
  }, invalidateNotifications);

  const clearNotifications = useInvalidatingMutation(async () => {
    const { data } = await apiClient.delete('/notifications/clear');
    return data;
  }, invalidateNotifications);

  return {
    data: getNotifications.data,
    notifications: toArray<any>(getNotifications.data?.data?.notifications).map(normalizeNotification),
    isLoading: getNotifications.isLoading,
    isError: getNotifications.isError,
    error: getNotifications.error,
    markAsRead,
    markAllAsRead,
    clearNotifications,
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
    unreadCount: Number(
      getUnreadCount.data?.data?.unreadCount
      ?? getUnreadCount.data?.data?.count
      ?? getUnreadCount.data?.unreadCount
      ?? getUnreadCount.data?.count
      ?? 0,
    ),
    isLoading: getUnreadCount.isLoading,
  };
};
