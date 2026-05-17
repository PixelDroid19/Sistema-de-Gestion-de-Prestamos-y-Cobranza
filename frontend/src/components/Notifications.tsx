import React from 'react';
import { Bell, CheckCircle2, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../i18n';
import { formatDateTime, formatNumber } from '../i18n/format';
import { tTerm } from '../i18n/terminology';
import { useNotifications, resolveNotificationDestinationForUser } from '../services/notificationService';
import { getSafeErrorText } from '../services/safeErrorMessages';
import { toast } from '../lib/toast';
import { confirm as confirmModal } from '../lib/confirmModal';
import { useSessionStore } from '../store/sessionStore';
import { ActionButton, ClickableSurface, DataTableSurface, EmptyState, PageHeader, PageShell } from './shared/Surfaces';

const formatNotificationDate = (value: unknown) => {
  return formatDateTime(value) || tTerm('common.dateUnavailable');
};

export default function Notifications() {
  useTranslation();
  const navigate = useNavigate();
  const { user } = useSessionStore();
  const { notifications, isLoading, isError, error, markAsRead, markAllAsRead, clearNotifications } = useNotifications();

  const unreadCount = notifications.filter((n: any) => !n?.read).length;

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsRead.mutateAsync(undefined);
      toast.success({ description: tTerm('notifications.toast.markAllRead.success') });
    } catch (markError) {
      toast.apiErrorSafe(markError, { domain: 'notifications', action: 'notifications.load' });
    }
  };

  const handleClearNotifications = async () => {
    const confirmed = await confirmModal({
      title: tTerm('notifications.confirm.clear.title'),
      message: tTerm('notifications.confirm.clear.message'),
      confirmLabel: tTerm('notifications.confirm.clear.confirm'),
      confirmVariant: 'danger',
    });

    if (!confirmed) return;

    try {
      await clearNotifications.mutateAsync(undefined);
      toast.success({ description: tTerm('notifications.toast.clear.success') });
    } catch (clearError) {
      toast.apiErrorSafe(clearError, { domain: 'notifications', action: 'notifications.load' });
    }
  };

  const handleOpenNotification = async (notification: any) => {
    if (!notification) {
      return;
    }

    if (!notification.read && notification.id != null) {
      try {
        await markAsRead.mutateAsync(notification.id);
      } catch (readError) {
        toast.apiErrorSafe(readError, { domain: 'notifications', action: 'notifications.load' });
      }
    }

    if (notification.destination) {
      navigate(notification.destination);
    }
  };

  return (
    <PageShell className="mx-auto w-full max-w-3xl" data-tour="notifications-page">
      <PageHeader
        title={(
          <span className="inline-flex flex-wrap items-center gap-2">
            <Bell size={24} className="shrink-0 text-brand-primary" aria-hidden />
            {tTerm('notifications.header.title')}
            {unreadCount > 0 ? (
              <span className="rounded-full bg-red-600 px-2.5 py-0.5 text-xs font-semibold text-white">
                {tTerm('notifications.header.unreadCount', { count: formatNumber(unreadCount) })}
              </span>
            ) : null}
          </span>
        )}
        subtitle={tTerm('notifications.header.subtitle')}
        guideKey="notifications"
        tourId="notifications-header"
        actions={(
          <div className="flex flex-wrap gap-2" data-tour="notifications-actions">
          <ActionButton
            onClick={handleMarkAllAsRead}
            disabled={unreadCount === 0 || markAllAsRead.isPending}
            icon={<CheckCircle2 size={16} />}
          >
            {markAllAsRead.isPending ? tTerm('notifications.action.markingAllRead') : tTerm('notifications.action.markAllRead')}
          </ActionButton>
          <ActionButton
            type="button"
            onClick={handleClearNotifications}
            disabled={notifications.length === 0 || clearNotifications.isPending}
            variant="danger"
            icon={<Trash2 size={16} />}
          >
            {clearNotifications.isPending ? tTerm('notifications.action.clearing') : tTerm('notifications.action.clear')}
          </ActionButton>
          </div>
        )}
      />

      <DataTableSurface className="flex flex-1 flex-col divide-y divide-border-subtle" data-tour="notifications-list">
        {isLoading ? (
          <EmptyState compact title={tTerm('notifications.state.loading')} />
        ) : isError ? (
          <EmptyState compact title={getSafeErrorText(error, { domain: 'notifications', action: 'notifications.load' })} />
        ) : notifications.length === 0 ? (
          <EmptyState title={tTerm('notifications.state.emptyTitle')} description={tTerm('notifications.state.emptyDescription')} />
        ) : (
          notifications.map((notification: any) => {
            const destination = resolveNotificationDestinationForUser(notification, user);
            const canOpen = Boolean(destination);
            const key = notification.id ?? `${notification.title}-${notification.createdAt ?? 'sin-fecha'}`;
            const containerClassName = `w-full px-4 py-5 text-left transition-colors ${!notification.read ? 'bg-brand-primary/[0.04] dark:bg-brand-primary/10' : 'hover:bg-hover-bg'} ${canOpen ? 'cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/35' : ''}`;

            const content = (
              <>
                <div
                  className={`mt-1.5 size-2 shrink-0 rounded-full ${!notification.read ? 'bg-red-600' : 'bg-transparent'}`}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <div className="flex gap-3 sm:items-start">
                    <div className="min-w-0 flex-1">
                      <h4 className={`text-sm ${!notification.read ? 'font-semibold text-text-primary' : 'font-medium text-text-secondary'}`}>
                        {notification.title}
                      </h4>
                      <p className="mt-1.5 text-sm leading-relaxed text-text-primary/85 dark:text-text-primary/80">
                        {notification.message || tTerm('notifications.item.emptyMessage')}
                      </p>
                    </div>
                    <div className="flex w-[4.75rem] shrink-0 justify-end pt-0.5">
                      {canOpen ? (
                        <span className="rounded-full border border-border-strong bg-bg-base px-2.5 py-1 text-xs font-medium text-text-primary">
                          {tTerm('common.cta.open')}
                        </span>
                      ) : (
                        <span className="inline-block min-h-[1.75rem] w-full" aria-hidden />
                      )}
                    </div>
                  </div>
                  <span className="mt-2.5 block text-xs font-medium text-text-primary/50 dark:text-text-secondary">
                    {formatNotificationDate(notification.createdAt)}
                  </span>
                </div>
              </>
            );

            if (canOpen) {
              return (
                <ClickableSurface
                  key={key}
                  variant="list"
                  className={containerClassName}
                  onClick={() => handleOpenNotification({ ...notification, destination })}
                  title={tTerm('notifications.item.openOrigin')}
                >
                  <div className="flex items-start gap-4">
                    {content}
                  </div>
                </ClickableSurface>
              );
            }

            return (
              <div key={key} className={containerClassName}>
                <div className="flex items-start gap-4">
                  {content}
                </div>
              </div>
            );
          })
        )}
      </DataTableSurface>
    </PageShell>
  );
}
