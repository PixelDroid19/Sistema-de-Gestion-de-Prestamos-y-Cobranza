import React, { useState, useEffect } from 'react';
import { Search, Bell, ChevronDown, ChevronLeft, ChevronRight, Sun, Moon, Menu } from 'lucide-react';
import { useSessionStore } from '../store/sessionStore';
import { useUnreadNotificationsCount } from '../services/notificationService';
import { getDefaultRouteForUser } from '../constants/appAccess';
import { safeLocalStorage } from '../lib/safeStorage';

export default function Header({ setCurrentView, toggleMobileSidebar }: { setCurrentView: (v: string) => void, toggleMobileSidebar?: () => void }) {
  const [isDark, setIsDark] = useState(false);
  const { user } = useSessionStore();
  const { unreadCount } = useUnreadNotificationsCount();

  useEffect(() => {
    // Check initial theme — default to light mode for better readability
    const savedTheme = safeLocalStorage.getItem('theme');
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark');
      setIsDark(true);
    } else {
      document.documentElement.classList.remove('dark');
      setIsDark(false);
    }
  }, []);

  const toggleTheme = () => {
    if (isDark) {
      document.documentElement.classList.remove('dark');
      safeLocalStorage.setItem('theme', 'light');
      setIsDark(false);
    } else {
      document.documentElement.classList.add('dark');
      safeLocalStorage.setItem('theme', 'dark');
      setIsDark(true);
    }
  };

  const displayDate = new Intl.DateTimeFormat('es-CO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date());

  const userLabel = user?.name?.trim() || 'Usuario';
  const userHandle = user?.email || 'sin-correo';
  const roleLabel = user?.role === 'admin'
    ? 'Administrador'
    : user?.role === 'socio'
      ? 'Socio'
      : 'Cliente';
  const homeView = getDefaultRouteForUser(user).replace(/^\//u, '');

  return (
    <header className="min-h-16 flex items-center justify-between gap-3 px-3 py-3 sm:px-4 lg:px-6 border-b border-border-subtle shrink-0 bg-bg-surface z-10">
      <div className="flex min-w-0 items-center gap-3">
        {toggleMobileSidebar && (
          <button 
            className="md:hidden p-2 text-text-secondary hover:text-text-primary rounded-lg hover:bg-hover-bg transition-colors"
            onClick={toggleMobileSidebar}
            aria-label="Abrir menú"
          >
            <Menu size={24} />
          </button>
        )}
        <div className="hidden min-w-0 cursor-pointer items-center gap-2 sm:flex" onClick={() => setCurrentView(homeView)}>
          <span className="truncate text-base font-semibold lg:text-lg">Sistema de Préstamos</span>
          <ChevronDown size={16} className="hidden shrink-0 text-text-secondary md:block" />
        </div>
      </div>

      <div className="flex min-w-0 items-center justify-end gap-2 sm:gap-3 lg:gap-4">
        <div className="relative hidden lg:block">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
          <input 
            type="text" 
            placeholder="Buscar..." 
            className="w-[min(20rem,28vw)] rounded-full border border-border-subtle bg-bg-surface py-2 pl-10 pr-10 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-border-strong"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 bg-hover-bg rounded flex items-center justify-center">
            <span className="text-[10px] text-text-secondary">↑</span>
          </div>
        </div>

        <button 
          onClick={toggleTheme}
          className="flex items-center justify-center w-10 h-10 bg-bg-surface rounded-full text-text-secondary hover:text-text-primary hover:bg-hover-bg transition-colors border border-border-subtle shrink-0"
          title={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
        >
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <button 
          onClick={() => setCurrentView('notifications')}
          className="relative flex shrink-0 items-center gap-2 rounded-full border border-border-subtle bg-bg-surface px-3 py-2 text-sm transition-colors hover:bg-hover-bg sm:px-4"
          aria-label={unreadCount > 0 ? `${unreadCount} notificaciones nuevas` : 'Sin notificaciones nuevas'}
        >
          <Bell size={16} className="text-text-secondary" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
          <span className="hidden xl:inline">
            {unreadCount > 0 ? `${unreadCount} nuevas` : 'Sin novedades'}
          </span>
        </button>

        <div className="hidden items-center gap-3 rounded-full border border-border-subtle bg-bg-surface px-4 py-2 text-sm 2xl:flex">
          <button className="text-text-secondary hover:text-text-primary"><ChevronLeft size={16} /></button>
          <span>{displayDate}</span>
          <button className="text-text-secondary hover:text-text-primary"><ChevronRight size={16} /></button>
        </div>

        <div className="flex min-w-0 cursor-pointer items-center gap-2 rounded-xl p-1.5 transition-colors hover:bg-hover-bg md:gap-3 md:p-2" onClick={() => setCurrentView('profile')}>
          <img src="https://i.pravatar.cc/150?u=admin" alt="Usuario" className="h-9 w-9 shrink-0 rounded-full border border-border-strong md:h-10 md:w-10" />
          <div className="hidden min-w-0 max-w-[14rem] flex-col sm:flex">
            <div className="flex items-center gap-1">
              <span className="truncate text-sm font-medium">{roleLabel}</span>
              <ChevronDown size={14} className="shrink-0 text-text-secondary" />
            </div>
            <span className="truncate text-xs text-text-secondary">{userLabel} · {userHandle}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
