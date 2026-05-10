import React from 'react';
import { Bell, CheckCircle2, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useNotifications, resolveNotificationDestinationForUser } from '../services/notificationService';
import { getSafeErrorText } from '../services/safeErrorMessages';
import { toast } from '../lib/toast';
import { confirm as confirmModal } from '../lib/confirmModal';
import { useSessionStore } from '../store/sessionStore';
import { QuickGuideButton } from './shared/HelpSupport';

const formatNotificationDate = (value: unknown) => {
  if (!value) {
    return 'Fecha no disponible';
  }

  const date = new Date(value as string | number | Date);
  return Number.isNaN(date.getTime())
    ? 'Fecha no disponible'
    : date.toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });
};

export default function Notifications() {
  const navigate = useNavigate();
  const { user } = useSessionStore();
  const { notifications, isLoading, isError, error, markAsRead, markAllAsRead, clearNotifications } = useNotifications();

  const unreadCount = notifications.filter((n: any) => !n?.read).length;

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsRead.mutateAsync(undefined);
      toast.success({ description: 'Notificaciones marcadas como leídas.' });
    } catch (markError) {
      toast.apiErrorSafe(markError, { domain: 'notifications', action: 'notifications.load' });
    }
  };

  const handleClearNotifications = async () => {
    const confirmed = await confirmModal({
      title: 'Limpiar notificaciones',
      message: 'Se eliminarán todas tus notificaciones actuales. Esta acción no cambia los créditos ni los cobros.',
      confirmLabel: 'Limpiar',
      confirmVariant: 'danger',
    });

    if (!confirmed) return;

    try {
      await clearNotifications.mutateAsync(undefined);
      toast.success({ description: 'Notificaciones eliminadas.' });
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
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col gap-6" data-tour="notifications-page">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between" data-tour="notifications-header">
        <div className="min-w-0">
          <h2 className="flex flex-wrap items-center gap-2 text-2xl font-semibold text-text-primary tracking-tight">
            <Bell size={24} className="shrink-0 text-brand-primary" aria-hidden /> Notificaciones
            {unreadCount > 0 && (
              <span className="rounded-full bg-red-600 px-2.5 py-0.5 text-xs font-semibold text-white">
                {unreadCount} no leídas
              </span>
            )}
          </h2>
          <p className="mt-1 text-sm text-text-secondary">Alertas operativas, cobros y novedades del sistema.</p>
        </div>
        <div className="flex flex-wrap gap-3" data-tour="notifications-actions">
          <QuickGuideButton guideKey="notifications" />
          <button 
            onClick={handleMarkAllAsRead}
            disabled={unreadCount === 0 || markAllAsRead.isPending}
            className="flex items-center gap-2 rounded-lg border border-border-strong bg-bg-surface px-4 py-2 text-sm font-semibold text-text-primary hover:bg-hover-bg disabled:border-slate-300 disabled:bg-slate-100 disabled:text-slate-600 dark:disabled:border-slate-600 dark:disabled:bg-slate-800 dark:disabled:text-slate-300"
          >
            <CheckCircle2 size={16} /> {markAllAsRead.isPending ? 'Marcando...' : 'Marcar leídas'}
          </button>
          <button
            type="button"
            onClick={handleClearNotifications}
            disabled={notifications.length === 0 || clearNotifications.isPending}
            className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-800 hover:bg-red-100 disabled:border-red-200 disabled:bg-red-50 disabled:text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200 dark:disabled:border-red-500/30 dark:disabled:bg-red-500/10 dark:disabled:text-red-200"
          >
            <Trash2 size={16} /> {clearNotifications.isPending ? 'Limpiando...' : 'Limpiar'}
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col divide-y divide-border-subtle overflow-hidden rounded-xl border border-border-subtle bg-bg-surface shadow-sm" data-tour="notifications-list">
        {isLoading ? (
          <div className="px-4 py-10 text-center text-sm text-text-secondary">Cargando notificaciones...</div>
        ) : isError ? (
          <div className="px-4 py-10 text-center text-sm text-red-600 dark:text-red-400">
            {getSafeErrorText(error, { domain: 'notifications', action: 'notifications.load' })}
          </div>
        ) : notifications.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-text-secondary">No tienes notificaciones.</div>
        ) : (
          notifications.map((notification: any) => {
            const destination = resolveNotificationDestinationForUser(notification, user);
            const canOpen = Boolean(destination);
            const key = notification.id ?? `${notification.title}-${notification.createdAt ?? 'sin-fecha'}`;
            const containerClassName = `w-full px-4 py-5 text-left transition-colors ${!notification.read ? 'bg-brand-primary/[0.04] dark:bg-brand-primary/10' : 'hover:bg-hover-bg'} ${canOpen ? 'cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/35' : ''}`;

            const content = (
              <>
                <div
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${!notification.read ? 'bg-red-600' : 'bg-transparent'}`}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <div className="flex gap-3 sm:items-start">
                    <div className="min-w-0 flex-1">
                      <h4 className={`text-sm ${!notification.read ? 'font-semibold text-text-primary' : 'font-medium text-text-secondary'}`}>
                        {notification.title}
                      </h4>
                      <p className="mt-1.5 text-sm leading-relaxed text-text-primary/85 dark:text-text-primary/80">
                        {notification.message || 'Sin contenido'}
                      </p>
                    </div>
                    <div className="flex w-[4.75rem] shrink-0 justify-end pt-0.5">
                      {canOpen ? (
                        <span className="rounded-full border border-border-strong bg-bg-base px-2.5 py-1 text-xs font-medium text-text-primary">
                          Abrir
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
                <button
                  key={key}
                  type="button"
                  className={containerClassName}
                  onClick={() => handleOpenNotification({ ...notification, destination })}
                  title="Abrir origen de la notificación"
                >
                  <div className="flex items-start gap-4">
                    {content}
                  </div>
                </button>
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
      </div>
    </div>
  );
}
