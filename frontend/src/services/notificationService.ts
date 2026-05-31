import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import type { AppUserLike } from '../constants/appAccess';
import { tTerm } from '../i18n/terminology';
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

const isAdministrativeRole = (role?: string): boolean => {
  return role === 'admin' || role === 'employee';
};

const TECHNICAL_NOTIFICATION_PATTERN = /(?:\b(?:actorId|userId|loanId|customerId|associateId|paymentId|policyId|calculationProfileVersionId|calculationVersionId|policySnapshot|payload|sequelize|constraint|stack|exception|trace)\b|[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}|[{[\]}])/i;
const TECHNICAL_TITLE_PATTERN = /(?:^|[\s:/-])[A-Z][A-Z0-9_]{2,}(?:$|[\s:/-])/;
const RAW_ENTITY_REFERENCE_PATTERN = /\b(?:cr[eé]dito|cliente|socio|pago)\s*#\d+\b/i;

const isTechnicalNotificationText = (value: string, { title = false } = {}) => {
  if (TECHNICAL_NOTIFICATION_PATTERN.test(value)) {
    return true;
  }

  if (RAW_ENTITY_REFERENCE_PATTERN.test(value)) {
    return true;
  }

  return title && TECHNICAL_TITLE_PATTERN.test(value);
};

const notificationTitleFallbackKeys = {
  loan_assignment: 'notifications.item.title.loanAssignment',
  loan_reminder: 'notifications.item.title.loanReminder',
  payment_registered: 'notifications.item.title.paymentRegistered',
  promise_created: 'notifications.item.title.promiseCreated',
  promise_status: 'notifications.item.title.promiseStatus',
} as const;

export const getNotificationTitle = (notification: any) => {
  const rawTitle = typeof notification?.title === 'string' ? notification.title.trim() : '';
  const type = String(notification?.type || '');
  const fallbackKey = notificationTitleFallbackKeys[type as keyof typeof notificationTitleFallbackKeys];
  const fallback = fallbackKey
    ? tTerm(fallbackKey)
    : tTerm('notifications.item.title.generic');

  if (!rawTitle) {
    return fallback;
  }

  if (isTechnicalNotificationText(rawTitle, { title: true })) {
    return fallback;
  }

  return rawTitle;
};

const notificationMessageFallbackKeys = {
  loan_assignment: 'notifications.item.message.loanAssignment',
  loan_reminder: 'notifications.item.message.loanReminder',
  payment_registered: 'notifications.item.message.paymentRegistered',
  promise_created: 'notifications.item.message.promiseCreated',
  promise_status: 'notifications.item.message.promiseStatus',
} as const;

export const getNotificationMessage = (notification: any) => {
  const rawMessage = typeof notification?.message === 'string' ? notification.message.trim() : '';
  const type = String(notification?.type || '');
  const fallbackKey = notificationMessageFallbackKeys[type as keyof typeof notificationMessageFallbackKeys];
  const fallback = fallbackKey
    ? tTerm(fallbackKey)
    : tTerm('notifications.item.message.generic');

  if (!rawMessage) {
    return fallback;
  }

  if (isTechnicalNotificationText(rawMessage)) {
    return fallback;
  }

  return rawMessage;
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

export const resolveNotificationDestinationForUser = (
  notification: any,
  user: AppUserLike,
): string | null => {
  const destination = resolveNotificationDestination(notification);

  if (!destination || !user?.role) {
    return null;
  }

  if (!isAdministrativeRole(user.role)) {
    return null;
  }

  if (destination.startsWith('/credits/')) {
    return destination;
  }

  if (destination.startsWith('/customers/')) {
    return user.role === 'admin' ? destination : null;
  }

  if (destination.startsWith('/associates/')) {
    if (user.role === 'admin') {
      return destination;
    }
  }

  return null;
};

const normalizeNotification = (notification: any) => ({
  ...notification,
  title: getNotificationTitle(notification),
  message: getNotificationMessage(notification),
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
