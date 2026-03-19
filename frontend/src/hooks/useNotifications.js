import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationService } from '../services/notificationService';
import { queryKeys } from '../lib/api/queryKeys';

export const useNotificationsQuery = ({ enabled = true, refetchInterval = false } = {}) => useQuery({
  queryKey: queryKeys.notifications.all(),
  queryFn: notificationService.getNotifications,
  enabled,
  refetchInterval,
});

export const useUnreadCountQuery = ({ enabled = true, refetchInterval = false } = {}) => useQuery({
  queryKey: queryKeys.notifications.unreadCount(),
  queryFn: notificationService.getUnreadCount,
  enabled,
  refetchInterval,
});

export const useMarkNotificationReadMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: notificationService.markAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.summary() });
    },
  });
};

export const useMarkAllNotificationsReadMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: notificationService.markAllAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.summary() });
    },
  });
};

export const useClearNotificationsMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: notificationService.clearNotifications,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.summary() });
    },
  });
};

export const useRegisterNotificationSubscriptionMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: notificationService.registerSubscription,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount() });
    },
  });
};

export const useRegisterBrowserNotificationSubscriptionMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: notificationService.registerBrowserSubscription,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount() });
    },
  });
};

export const useDeleteNotificationSubscriptionMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: notificationService.deleteSubscription,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount() });
    },
  });
};
