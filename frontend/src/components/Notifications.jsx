import React, { useEffect, useMemo, useState } from 'react';
import { Bell, Smartphone, Globe, Trash2, CheckCheck, X } from 'lucide-react';

import { handleApiError } from '@/lib/api/errors';
import {
  useClearNotificationsMutation,
  useDeleteNotificationSubscriptionMutation,
  useMarkAllNotificationsReadMutation,
  useMarkNotificationReadMutation,
  useNotificationsQuery,
  useRegisterBrowserNotificationSubscriptionMutation,
  useRegisterNotificationSubscriptionMutation,
} from '@/hooks/useNotifications';
import EmptyState from '@/components/ui/workspace/EmptyState';
import FilterBar from '@/components/ui/workspace/FilterBar';
import FormSection from '@/components/ui/workspace/FormSection';
import StatCard from '@/components/ui/workspace/StatCard';
import WorkspaceCard from '@/components/ui/workspace/WorkspaceCard';

const PROVIDER_PRESETS = {
  webpush: {
    channel: 'web',
    title: 'Browser push',
    description: 'Best when staff use notifications from this browser session.',
    endpointLabel: 'Browser endpoint',
    endpointPlaceholder: 'https://push.example/subscription-id',
    tokenLabel: 'Device token',
    tokenPlaceholder: 'Not used for browser push',
    requiresSubscriptionJson: true,
    subscriptionExample: '{"endpoint":"https://push.example/subscription-id","keys":{"p256dh":"public-key","auth":"secret"}}',
  },
  fcm: {
    channel: 'mobile',
    title: 'Android / FCM',
    description: 'Use this when a mobile app gives you a Firebase device token.',
    endpointLabel: 'Endpoint',
    endpointPlaceholder: 'Optional endpoint label',
    tokenLabel: 'Firebase device token',
    tokenPlaceholder: 'fcm-device-token',
    requiresSubscriptionJson: false,
    subscriptionExample: '',
  },
  apns: {
    channel: 'mobile',
    title: 'iPhone / APNS',
    description: 'Use this when the iOS app gives you an Apple push token.',
    endpointLabel: 'Endpoint',
    endpointPlaceholder: 'Optional endpoint label',
    tokenLabel: 'Apple device token',
    tokenPlaceholder: 'apns-device-token',
    requiresSubscriptionJson: false,
    subscriptionExample: '',
  },
};

const createSubscriptionForm = (providerKey = 'webpush') => ({
  providerKey,
  channel: PROVIDER_PRESETS[providerKey].channel,
  endpoint: '',
  deviceToken: '',
  subscription: PROVIDER_PRESETS[providerKey].subscriptionExample,
});

const emptyNotifications = [];

function NotificationHeader({ unreadCount, totalCount, onClose }) {
  return (
    <div className="notifications-modal__hero">
      <div>
        <div className="notifications-modal__eyebrow">Notification center</div>
        <h3 className="notifications-modal__title"><Bell size={18} /> Notifications</h3>
        <p className="notifications-modal__subtitle">{unreadCount} unread • {totalCount} total</p>
      </div>
      <button type="button" onClick={onClose} className="btn btn-outline-primary notifications-modal__close">
        <X size={16} /> Close
      </button>
    </div>
  );
}

function NotificationsSummary({ notificationBuckets, error, success }) {
  return (
    <div className="notifications-modal__summary">
      <div className="metric-grid notifications-modal__summary-grid">
        <StatCard label="Unread" value={notificationBuckets.unread} caption="Requires attention" tone="warning" />
        <StatCard label="Loan-linked" value={notificationBuckets.loanLinked} caption="Linked to active workflows" tone="info" />
        <StatCard label="Subscriptions" value="Guided setup" caption="Browser or mobile channels" tone="brand" />
      </div>
      {error && <div className="inline-message inline-message--error notifications-modal__message">⚠️ {error}</div>}
      {success && <div className="inline-message inline-message--success notifications-modal__message">✅ {success}</div>}
    </div>
  );
}

function NotificationFeed({ loading, notifications, unreadCount, markAllReadMutation, clearMutation, onMarkAllAsRead, onClearAll, onRefresh, onMarkAsRead }) {
  return (
    <div className="notifications-modal__feed">
      <FilterBar className="notifications-modal__feed-actions">
        <button type="button" className="btn btn-success" onClick={onMarkAllAsRead} disabled={unreadCount === 0 || markAllReadMutation.isPending}>
          <CheckCheck size={16} /> Mark all read
        </button>
        <button type="button" className="btn btn-danger" onClick={onClearAll} disabled={clearMutation.isPending}>
          <Trash2 size={16} /> Clear all
        </button>
        <button type="button" className="btn btn-outline-primary" onClick={onRefresh}>Refresh</button>
      </FilterBar>

      {loading ? (
        <div className="notifications-modal__loading">Loading notifications...</div>
      ) : notifications.length === 0 ? (
        <div className="notifications-modal__empty-wrap">
          <EmptyState
            icon="🔔"
            title="No notifications"
            description="You're all caught up. New activity will appear here."
          />
        </div>
      ) : (
        <div className="notifications-modal__feed-list">
          {notifications.map((notification) => {
            const notificationData = notification.payload || notification.data || {};
            return (
              <button
                key={notification.id}
                type="button"
                onClick={() => !notification.isRead && onMarkAsRead(notification.id)}
                className={`notifications-modal__item${notification.isRead ? '' : ' notifications-modal__item--unread'}`}
              >
                <div className="notifications-modal__item-header">
                  <div>
                    <div className="notifications-modal__item-message">{notification.message}</div>
                    <div className="notifications-modal__item-date">{new Date(notification.createdAt).toLocaleString()}</div>
                  </div>
                  {!notification.isRead && <span className="status-badge status-badge--info">Unread</span>}
                </div>
                <div className="notifications-modal__item-tags">
                  {notification.type && <span className="status-note">{notification.type.replaceAll('_', ' ')}</span>}
                  {notificationData.loanId && <span className="status-note">Loan #{notificationData.loanId}</span>}
                  {notificationData.customerName && <span className="status-note">{notificationData.customerName}</span>}
                  {notificationData.loanAmount && <span className="status-note">₹{notificationData.loanAmount}</span>}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SubscriptionManager({
  subscriptionForm,
  providerPreset,
  registerSubscriptionMutation,
  registerBrowserSubscriptionMutation,
  deleteSubscriptionMutation,
  onProviderSelect,
  onUseBrowserSubscription,
  onLoadSampleJson,
  onRegisterSubscription,
  onDeleteSubscription,
  setSubscriptionForm,
}) {
  return (
    <div className="notifications-modal__subscriptions">
      <WorkspaceCard
        compact
        eyebrow="Subscription management"
        title="Connect a device for push updates"
        subtitle="Pick the device type first, then provide only the fields that backend registration expects for that provider."
      >
      <FilterBar className="notifications-modal__provider-switcher">
        {Object.entries(PROVIDER_PRESETS).map(([providerKey, preset]) => (
          <button
            key={providerKey}
            className={`btn ${subscriptionForm.providerKey === providerKey ? 'btn-primary' : 'btn-outline-primary'}`}
            type="button"
            onClick={() => onProviderSelect(providerKey)}
          >
            {preset.title}
          </button>
        ))}
      </FilterBar>

      <WorkspaceCard compact className="notifications-modal__provider-card">
          <div className="section-title notifications-modal__provider-title">{providerPreset.title}</div>
          <div className="section-subtitle notifications-modal__provider-description">{providerPreset.description}</div>
          <div className="status-note">Channel: {providerPreset.channel}</div>
          {subscriptionForm.providerKey === 'webpush' && (
            <div className="section-actions section-actions--start notifications-modal__provider-actions">
              <button className="btn btn-outline-primary" type="button" onClick={onUseBrowserSubscription} disabled={registerBrowserSubscriptionMutation.isPending}>
                Use current browser subscription
              </button>
              <button className="btn btn-outline-primary" type="button" onClick={onLoadSampleJson}>
                Load sample JSON
              </button>
            </div>
          )}
      </WorkspaceCard>

      <form onSubmit={onRegisterSubscription} className="dashboard-form-grid notifications-modal__subscription-form">
        <label className="field-group">
          <span className="field-label">Provider</span>
          <select className="field-control" value={subscriptionForm.providerKey} onChange={(event) => onProviderSelect(event.target.value)}>
            <option value="webpush">webpush</option>
            <option value="fcm">fcm</option>
            <option value="apns">apns</option>
          </select>
        </label>
        <label className="field-group">
          <span className="field-label">Channel</span>
          <input className="field-control" value={providerPreset.channel} readOnly />
        </label>
        <label className="field-group">
          <span className="field-label">{providerPreset.endpointLabel}</span>
          <div className="notifications-modal__input-with-icon">
            <Globe size={16} />
            <input className="field-control" value={subscriptionForm.endpoint} onChange={(event) => setSubscriptionForm((current) => ({ ...current, endpoint: event.target.value }))} placeholder={providerPreset.endpointPlaceholder} />
          </div>
        </label>
        <label className="field-group">
          <span className="field-label">{providerPreset.tokenLabel}</span>
          <div className="notifications-modal__input-with-icon">
            <Smartphone size={16} />
            <input className="field-control" value={subscriptionForm.deviceToken} onChange={(event) => setSubscriptionForm((current) => ({ ...current, deviceToken: event.target.value }))} placeholder={providerPreset.tokenPlaceholder} disabled={providerPreset.requiresSubscriptionJson} />
          </div>
        </label>
        <label className="field-group notifications-modal__full-width">
          <span className="field-label">Subscription JSON</span>
          <textarea className="field-control" rows="6" value={subscriptionForm.subscription} onChange={(event) => setSubscriptionForm((current) => ({ ...current, subscription: event.target.value }))} disabled={!providerPreset.requiresSubscriptionJson} placeholder={providerPreset.requiresSubscriptionJson ? providerPreset.subscriptionExample : 'Not required for this provider'}></textarea>
        </label>
        <div className="section-actions section-actions--start notifications-modal__full-width">
          <button className="btn btn-primary" type="submit" disabled={registerSubscriptionMutation.isPending || registerBrowserSubscriptionMutation.isPending}>Save subscription</button>
          <button className="btn btn-outline-primary" type="button" onClick={onDeleteSubscription} disabled={deleteSubscriptionMutation.isPending}>Remove subscription</button>
        </div>
      </form>
      </WorkspaceCard>
    </div>
  );
}

function Notifications({ user, isOpen, onClose }) {
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [subscriptionForm, setSubscriptionForm] = useState(() => createSubscriptionForm());

  const notificationsQuery = useNotificationsQuery({
    enabled: Boolean(user) && isOpen,
    refetchInterval: isOpen ? 30000 : false,
  });
  const markReadMutation = useMarkNotificationReadMutation();
  const markAllReadMutation = useMarkAllNotificationsReadMutation();
  const clearMutation = useClearNotificationsMutation();
  const registerSubscriptionMutation = useRegisterNotificationSubscriptionMutation();
  const registerBrowserSubscriptionMutation = useRegisterBrowserNotificationSubscriptionMutation();
  const deleteSubscriptionMutation = useDeleteNotificationSubscriptionMutation();

  useEffect(() => {
    if (notificationsQuery.error) {
      handleApiError(notificationsQuery.error, setError);
    }
  }, [notificationsQuery.error]);

  const payload = notificationsQuery.data?.data || {};
  const notifications = useMemo(
    () => (Array.isArray(payload.notifications) ? payload.notifications : emptyNotifications),
    [payload.notifications],
  );
  const unreadCount = Number(payload.unreadCount || 0);
  const totalCount = Number(payload.totalCount || notifications.length);
  const loading = notificationsQuery.isLoading;
  const providerPreset = PROVIDER_PRESETS[subscriptionForm.providerKey];

  const notificationBuckets = useMemo(() => ({
    unread: notifications.filter((notification) => !notification.isRead).length,
    loanLinked: notifications.filter((notification) => notification.payload?.loanId || notification.data?.loanId).length,
  }), [notifications]);

  const showSuccess = (message) => {
    setSuccess(message);
    setError('');
  };

  const handleProviderSelect = (providerKey) => {
    setSubscriptionForm((current) => ({
      ...createSubscriptionForm(providerKey),
      endpoint: providerKey === current.providerKey ? current.endpoint : '',
      deviceToken: providerKey === current.providerKey ? current.deviceToken : '',
    }));
    setError('');
    setSuccess('');
  };

  const fetchNotifications = () => notificationsQuery.refetch();

  const validateSubscriptionRegistration = () => {
    if (subscriptionForm.providerKey === 'webpush') {
      if (!subscriptionForm.endpoint.trim()) {
        setError('Browser push needs the subscription endpoint before saving.');
        return null;
      }

      if (!subscriptionForm.subscription.trim()) {
        setError('Browser push also needs the subscription JSON payload.');
        return null;
      }

      try {
        const parsed = JSON.parse(subscriptionForm.subscription);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          setError('Subscription JSON must be a valid object.');
          return null;
        }

        return {
          providerKey: subscriptionForm.providerKey,
          channel: providerPreset.channel,
          endpoint: subscriptionForm.endpoint.trim(),
          subscription: parsed,
        };
      } catch {
        setError('Subscription JSON must be valid before registering.');
        return null;
      }
    }

    if (!subscriptionForm.deviceToken.trim()) {
      setError(`${providerPreset.title} needs a device token before saving.`);
      return null;
    }

    return {
      providerKey: subscriptionForm.providerKey,
      channel: providerPreset.channel,
      endpoint: subscriptionForm.endpoint.trim() || undefined,
      deviceToken: subscriptionForm.deviceToken.trim(),
    };
  };

  const validateSubscriptionDeletion = () => {
    if (subscriptionForm.providerKey === 'webpush') {
      if (!subscriptionForm.endpoint.trim()) {
        setError('Provide the browser endpoint you want to remove.');
        return null;
      }

      return {
        providerKey: subscriptionForm.providerKey,
        endpoint: subscriptionForm.endpoint.trim(),
      };
    }

    if (!subscriptionForm.deviceToken.trim()) {
      setError(`Provide the ${providerPreset.tokenLabel.toLowerCase()} you want to remove.`);
      return null;
    }

    return {
      providerKey: subscriptionForm.providerKey,
      deviceToken: subscriptionForm.deviceToken.trim(),
      endpoint: subscriptionForm.endpoint.trim() || undefined,
    };
  };

  const handleMarkAsRead = async (notificationId) => {
    try {
      await markReadMutation.mutateAsync(notificationId);
      showSuccess('Notification marked as read.');
    } catch (mutationError) {
      handleApiError(mutationError, setError);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllReadMutation.mutateAsync();
      showSuccess('All notifications marked as read.');
    } catch (mutationError) {
      handleApiError(mutationError, setError);
    }
  };

  const handleClearAll = async () => {
    try {
      await clearMutation.mutateAsync();
      showSuccess('Notifications cleared successfully.');
    } catch (mutationError) {
      handleApiError(mutationError, setError);
    }
  };

  const handleRegisterSubscription = async (event) => {
    event.preventDefault();
    const payload = validateSubscriptionRegistration();
    if (!payload) return;

    try {
      await registerSubscriptionMutation.mutateAsync(payload);
      showSuccess('Notification subscription registered successfully.');
    } catch (mutationError) {
      handleApiError(mutationError, setError);
    }
  };

  const handleDeleteSubscription = async () => {
    const payload = validateSubscriptionDeletion();
    if (!payload) return;

    try {
      await deleteSubscriptionMutation.mutateAsync(payload);
      showSuccess('Notification subscription deleted successfully.');
    } catch (mutationError) {
      handleApiError(mutationError, setError);
    }
  };

  const handleUseBrowserSubscription = async () => {
    if (!window.isSecureContext) {
      setError('Browser push can only be detected from a secure HTTPS context.');
      return;
    }

    if (!('serviceWorker' in navigator)) {
      setError('This browser does not expose service workers, so push setup cannot be detected here.');
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        setError('No browser push subscription is active yet. Subscribe in the app first, then sync it here.');
        return;
      }

      await registerBrowserSubscriptionMutation.mutateAsync(subscription.toJSON());
      setSubscriptionForm((current) => ({
        ...current,
        providerKey: 'webpush',
        channel: 'web',
        endpoint: subscription.endpoint || '',
        subscription: JSON.stringify(subscription.toJSON(), null, 2),
      }));
      showSuccess('Current browser subscription synced successfully.');
    } catch (mutationError) {
      handleApiError(mutationError, setError);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="notifications-modal__backdrop">
      <div className="notifications-modal__card">
        <NotificationHeader unreadCount={unreadCount} totalCount={totalCount} onClose={onClose} />
        <NotificationsSummary notificationBuckets={notificationBuckets} error={error} success={success} />

        <div className="notifications-modal__layout">
          <NotificationFeed
            loading={loading}
            notifications={notifications}
            unreadCount={unreadCount}
            markAllReadMutation={markAllReadMutation}
            clearMutation={clearMutation}
            onMarkAllAsRead={handleMarkAllAsRead}
            onClearAll={handleClearAll}
            onRefresh={fetchNotifications}
            onMarkAsRead={handleMarkAsRead}
          />

          <SubscriptionManager
            subscriptionForm={subscriptionForm}
            providerPreset={providerPreset}
            registerSubscriptionMutation={registerSubscriptionMutation}
            registerBrowserSubscriptionMutation={registerBrowserSubscriptionMutation}
            deleteSubscriptionMutation={deleteSubscriptionMutation}
            onProviderSelect={handleProviderSelect}
            onUseBrowserSubscription={handleUseBrowserSubscription}
            onLoadSampleJson={() => setSubscriptionForm((current) => ({ ...current, subscription: providerPreset.subscriptionExample }))}
            onRegisterSubscription={handleRegisterSubscription}
            onDeleteSubscription={handleDeleteSubscription}
            setSubscriptionForm={setSubscriptionForm}
          />
        </div>
      </div>
    </div>
  );
}

export default Notifications;
