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

const modalStyles = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15, 23, 42, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    backdropFilter: 'blur(6px)',
    padding: '1rem',
  },
  card: {
    background: 'var(--surface-color, #fff)',
    borderRadius: '20px',
    boxShadow: '0 24px 70px rgba(15, 23, 42, 0.25)',
    width: 'min(960px, 100%)',
    maxHeight: '90vh',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
};

function NotificationHeader({ unreadCount, totalCount, onClose }) {
  return (
    <div style={{
      padding: '1.5rem',
      background: 'linear-gradient(135deg, #0f4c81 0%, #1f7a8c 55%, #4f9d69 100%)',
      color: 'white',
      display: 'flex',
      justifyContent: 'space-between',
      gap: '1rem',
    }}>
      <div>
        <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.85 }}>Notification center</div>
        <h3 style={{ margin: '0.35rem 0 0.4rem', fontSize: '1.6rem' }}><Bell size={18} style={{ verticalAlign: 'text-bottom' }} /> Notifications</h3>
        <p style={{ margin: 0, opacity: 0.9 }}>{unreadCount} unread • {totalCount} total</p>
      </div>
      <button onClick={onClose} className="btn btn-outline-primary" style={{ alignSelf: 'flex-start', background: 'rgba(255,255,255,0.16)', color: 'white', borderColor: 'rgba(255,255,255,0.3)' }}>
        <X size={16} /> Close
      </button>
    </div>
  );
}

function NotificationsSummary({ notificationBuckets, error, success }) {
  return (
    <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-color)', background: 'var(--surface-muted, #f8fafc)' }}>
      <div className="summary-grid">
        <div className="detail-card"><div className="detail-card__label">Unread</div><div className="detail-card__value detail-card__value--warning">{notificationBuckets.unread}</div></div>
        <div className="detail-card"><div className="detail-card__label">Loan-linked</div><div className="detail-card__value detail-card__value--info">{notificationBuckets.loanLinked}</div></div>
        <div className="detail-card"><div className="detail-card__label">Subscriptions</div><div className="detail-card__value">Guided setup</div></div>
      </div>
      {error && <div className="inline-message inline-message--error" style={{ marginTop: '1rem' }}>⚠️ {error}</div>}
      {success && <div className="inline-message inline-message--success" style={{ marginTop: '1rem' }}>✅ {success}</div>}
    </div>
  );
}

function NotificationFeed({ loading, notifications, unreadCount, markAllReadMutation, clearMutation, onMarkAllAsRead, onClearAll, onRefresh, onMarkAsRead }) {
  return (
    <div style={{ borderRight: '1px solid var(--border-color)', overflow: 'auto' }}>
      <div style={{ padding: '1rem 1.5rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', borderBottom: '1px solid var(--border-color)' }}>
        <button className="btn btn-success" onClick={onMarkAllAsRead} disabled={unreadCount === 0 || markAllReadMutation.isPending}>
          <CheckCheck size={16} /> Mark all read
        </button>
        <button className="btn btn-danger" onClick={onClearAll} disabled={clearMutation.isPending}>
          <Trash2 size={16} /> Clear all
        </button>
        <button className="btn btn-outline-primary" onClick={onRefresh}>Refresh</button>
      </div>

      {loading ? (
        <div style={{ padding: '2rem' }}>{'Loading notifications...'}</div>
      ) : notifications.length === 0 ? (
        <div style={{ padding: '2rem' }}>
          <div className="state-panel">
            <div className="state-panel__icon">🔔</div>
            <div className="state-panel__title">No notifications</div>
            <div className="state-panel__text">You're all caught up. New activity will appear here.</div>
          </div>
        </div>
      ) : (
        <div style={{ padding: '1rem 1.5rem' }}>
          {notifications.map((notification) => {
            const notificationData = notification.payload || notification.data || {};
            return (
              <button
                key={notification.id}
                type="button"
                onClick={() => !notification.isRead && onMarkAsRead(notification.id)}
                style={{
                  padding: '1rem',
                  borderRadius: '16px',
                  border: '1px solid var(--border-color)',
                  marginBottom: '0.75rem',
                  background: notification.isRead ? 'var(--surface-color, #fff)' : 'rgba(31, 122, 140, 0.08)',
                  cursor: notification.isRead ? 'default' : 'pointer',
                  width: '100%',
                  textAlign: 'left',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                  <div>
                    <div style={{ fontWeight: notification.isRead ? 500 : 700, marginBottom: '0.35rem' }}>{notification.message}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{new Date(notification.createdAt).toLocaleString()}</div>
                  </div>
                  {!notification.isRead && <span className="status-badge status-badge--info">Unread</span>}
                </div>
                <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
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
    <div style={{ overflow: 'auto', padding: '1.5rem' }}>
      <div className="section-eyebrow">Subscription management</div>
      <div className="section-title" style={{ fontSize: '1.1rem', marginBottom: '0.4rem' }}>Connect a device for push updates</div>
      <div className="section-subtitle" style={{ marginBottom: '1rem' }}>
        Pick the device type first, then provide only the fields that backend registration expects for that provider.
      </div>

      <div className="section-actions" style={{ marginBottom: '1rem', justifyContent: 'flex-start' }}>
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
      </div>

      <div className="surface-card" style={{ marginBottom: '1rem' }}>
        <div className="surface-card__body" style={{ padding: '1rem' }}>
          <div className="section-title" style={{ fontSize: '1rem', marginBottom: '0.35rem' }}>{providerPreset.title}</div>
          <div className="section-subtitle" style={{ marginBottom: '0.75rem' }}>{providerPreset.description}</div>
          <div className="status-note">Channel: {providerPreset.channel}</div>
          {subscriptionForm.providerKey === 'webpush' && (
            <div className="section-actions" style={{ marginTop: '0.75rem', justifyContent: 'flex-start' }}>
              <button className="btn btn-outline-primary" type="button" onClick={onUseBrowserSubscription} disabled={registerBrowserSubscriptionMutation.isPending}>
                Use current browser subscription
              </button>
              <button className="btn btn-outline-primary" type="button" onClick={onLoadSampleJson}>
                Load sample JSON
              </button>
            </div>
          )}
        </div>
      </div>

      <form onSubmit={onRegisterSubscription} className="dashboard-form-grid">
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
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <Globe size={16} />
            <input className="field-control" value={subscriptionForm.endpoint} onChange={(event) => setSubscriptionForm((current) => ({ ...current, endpoint: event.target.value }))} placeholder={providerPreset.endpointPlaceholder} />
          </div>
        </label>
        <label className="field-group">
          <span className="field-label">{providerPreset.tokenLabel}</span>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <Smartphone size={16} />
            <input className="field-control" value={subscriptionForm.deviceToken} onChange={(event) => setSubscriptionForm((current) => ({ ...current, deviceToken: event.target.value }))} placeholder={providerPreset.tokenPlaceholder} disabled={providerPreset.requiresSubscriptionJson} />
          </div>
        </label>
        <label className="field-group" style={{ gridColumn: '1 / -1' }}>
          <span className="field-label">Subscription JSON</span>
          <textarea className="field-control" rows="6" value={subscriptionForm.subscription} onChange={(event) => setSubscriptionForm((current) => ({ ...current, subscription: event.target.value }))} disabled={!providerPreset.requiresSubscriptionJson} placeholder={providerPreset.requiresSubscriptionJson ? providerPreset.subscriptionExample : 'Not required for this provider'}></textarea>
        </label>
        <div className="section-actions" style={{ gridColumn: '1 / -1' }}>
          <button className="btn btn-primary" type="submit" disabled={registerSubscriptionMutation.isPending || registerBrowserSubscriptionMutation.isPending}>Save subscription</button>
          <button className="btn btn-outline-primary" type="button" onClick={onDeleteSubscription} disabled={deleteSubscriptionMutation.isPending}>Remove subscription</button>
        </div>
      </form>
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
    <div style={modalStyles.backdrop}>
      <div style={modalStyles.card}>
        <NotificationHeader unreadCount={unreadCount} totalCount={totalCount} onClose={onClose} />
        <NotificationsSummary notificationBuckets={notificationBuckets} error={error} success={success} />

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(320px, 0.8fr)', gap: '0', minHeight: 0, flex: 1 }}>
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
