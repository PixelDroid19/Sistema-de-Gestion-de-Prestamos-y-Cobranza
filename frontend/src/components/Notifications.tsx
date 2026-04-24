import React from 'react';
import { Bell, CheckCircle2, Trash2 } from 'lucide-react';
import { useNotifications } from '../services/notificationService';
import { getSafeErrorText } from '../services/safeErrorMessages';
import { toast } from '../lib/toast';
import { confirm as confirmModal } from '../lib/confirmModal';

const formatNotificationDate = (value: unknown) => {
  if (!value) {
    return 'Fecha no disponible';
  }

  const date = new Date(value as string | number | Date);
  return Number.isNaN(date.getTime()) ? 'Fecha no disponible' : date.toLocaleString();
};

export default function Notifications() {
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

  return (
    <div className="flex h-full w-full max-w-4xl flex-col gap-6 mx-auto">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-2xl font-semibold">
            <Bell size={24} /> Notificaciones
            {unreadCount > 0 && (
              <span className="bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full">{unreadCount} no leídas</span>
            )}
          </h2>
          <p className="mt-1 text-sm text-text-secondary">Alertas operativas, cobros y novedades del sistema.</p>
        </div>
        <div className="flex flex-wrap gap-3">
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

      <div className="bg-bg-surface rounded-2xl border border-border-subtle p-2 flex-1 flex flex-col gap-1">
        {isLoading ? (
          <div className="p-4 text-center text-text-secondary">Cargando notificaciones...</div>
        ) : isError ? (
          <div className="p-4 text-center text-red-500">
            {getSafeErrorText(error, { domain: 'notifications', action: 'notifications.load' })}
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-4 text-center text-text-secondary">No tienes notificaciones.</div>
        ) : (
          notifications.map((notification: any) => (
            <div 
              key={notification.id ?? `${notification.title}-${notification.createdAt ?? 'sin-fecha'}`} 
              className={`p-4 rounded-xl flex items-start gap-4 transition-colors ${!notification.read ? 'bg-hover-bg' : 'hover:bg-hover-bg'}`}
              onClick={() => {
                if (!notification.read && notification.id != null) {
                  markAsRead.mutateAsync(notification.id).catch((readError) => {
                    toast.apiErrorSafe(readError, { domain: 'notifications', action: 'notifications.load' });
                  });
                }
              }}
            >
              <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${!notification.read ? 'bg-blue-500' : 'bg-transparent'}`}></div>
              <div className="flex-1">
                <h4 className={`text-sm ${!notification.read ? 'font-medium text-text-primary' : 'text-text-secondary'}`}>
                  {notification.title}
                </h4>
                <p className="text-sm text-text-secondary mt-1">
                  {notification.message || 'Sin contenido'}
                </p>
                <span className="text-xs text-text-secondary mt-2 block">
                  {formatNotificationDate(notification.createdAt)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
