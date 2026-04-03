import React from 'react';
import { Bell, CheckCircle2, Trash2 } from 'lucide-react';
import { useNotifications } from '../services/notificationService';
import { getSafeErrorText } from '../services/safeErrorMessages';

const formatNotificationDate = (value: unknown) => {
  if (!value) {
    return 'Fecha no disponible';
  }

  const date = new Date(value as string | number | Date);
  return Number.isNaN(date.getTime()) ? 'Fecha no disponible' : date.toLocaleString();
};

export default function Notifications() {
  const { notifications, isLoading, isError, error, markAsRead } = useNotifications();

  const unreadCount = notifications.filter((n: any) => !n?.read).length;

  const handleMarkAllAsRead = () => {
    notifications.forEach((n: any) => {
      if (!n?.read && n?.id != null) {
        markAsRead.mutateAsync(n.id);
      }
    });
  };

  return (
    <div className="flex flex-col gap-6 h-full max-w-4xl mx-auto w-full">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <Bell size={24} /> Notificaciones
            {unreadCount > 0 && (
              <span className="bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full">{unreadCount} no leídas</span>
            )}
          </h2>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={handleMarkAllAsRead}
            disabled={unreadCount === 0}
            className="flex items-center gap-2 bg-bg-surface border border-border-strong text-text-primary px-4 py-2 rounded-lg text-sm font-medium hover:bg-hover-bg disabled:opacity-50"
          >
            <CheckCircle2 size={16} /> Marcar todas leídas
          </button>
          <button
            type="button"
            disabled
            title="Limpiar notificaciones aun no esta disponible"
            className="flex items-center gap-2 bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400 px-4 py-2 rounded-lg text-sm font-medium opacity-60 cursor-not-allowed"
          >
            <Trash2 size={16} /> Limpiar
          </button>
        </div>
      </div>

      <div className="bg-bg-surface rounded-2xl p-2 flex-1 flex flex-col gap-1">
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
                  markAsRead.mutateAsync(notification.id);
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
