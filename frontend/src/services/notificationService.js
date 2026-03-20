import { apiRequest } from '@/lib/api/client';

export const notificationService = {
  getNotifications: () => apiRequest('/api/notifications'),
  getUnreadCount: () => apiRequest('/api/notifications/unread-count'),
  markAsRead: (notificationId) => apiRequest(`/api/notifications/${notificationId}/read`, { method: 'PUT' }),
  markAllAsRead: () => apiRequest('/api/notifications/mark-all-read', { method: 'PATCH' }),
  registerBrowserSubscription: (subscription) => apiRequest('/api/notifications/subscriptions', {
    method: 'POST',
    body: {
      providerKey: 'webpush',
      channel: 'web',
      endpoint: subscription.endpoint,
      subscription,
    },
  }),
  registerSubscription: (payload) => apiRequest('/api/notifications/subscriptions', { method: 'POST', body: payload }),
  deleteSubscription: (payload) => apiRequest('/api/notifications/subscriptions', { method: 'DELETE', body: payload }),
  clearNotifications: () => apiRequest('/api/notifications/clear', { method: 'DELETE' }),
};
