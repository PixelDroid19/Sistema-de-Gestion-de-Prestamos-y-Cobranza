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
    <header className="h-16 md:h-20 flex items-center justify-between px-4 md:px-6 border-b border-border-subtle shrink-0 bg-bg-surface z-10">
      <div className="flex items-center gap-3">
        {toggleMobileSidebar && (
          <button 
            className="md:hidden p-2 text-text-secondary hover:text-text-primary rounded-lg hover:bg-hover-bg transition-colors"
            onClick={toggleMobileSidebar}
            aria-label="Abrir menú"
          >
            <Menu size={24} />
          </button>
        )}
        <div className="flex items-center gap-2 cursor-pointer hidden sm:flex" onClick={() => setCurrentView(homeView)}>
          <span className="font-semibold text-lg">Sistema de Préstamos</span>
          <ChevronDown size={16} className="text-text-secondary hidden md:block" />
        </div>
      </div>

      <div className="flex items-center gap-3 md:gap-4">
        <div className="relative hidden md:block">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
          <input 
            type="text" 
            placeholder="Buscar..." 
            className="bg-bg-surface text-sm text-text-primary rounded-full pl-10 pr-10 py-2 w-64 focus:outline-none focus:ring-1 focus:ring-border-strong border border-border-subtle"
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
          className="flex items-center gap-2 bg-bg-surface px-4 py-2 rounded-full text-sm hover:bg-hover-bg transition-colors border border-border-subtle"
        >
          <Bell size={16} className="text-text-secondary" />
          <span className="hidden sm:inline">
            {unreadCount > 0 ? `${unreadCount} nuevas` : 'Sin novedades'}
          </span>
        </button>

        <div className="items-center gap-3 bg-bg-surface px-4 py-2 rounded-full text-sm hidden lg:flex border border-border-subtle">
          <button className="text-text-secondary hover:text-text-primary"><ChevronLeft size={16} /></button>
          <span>{displayDate}</span>
          <button className="text-text-secondary hover:text-text-primary"><ChevronRight size={16} /></button>
        </div>

        <div className="flex items-center gap-3 sm:ml-2 cursor-pointer hover:bg-hover-bg p-1.5 md:p-2 rounded-xl transition-colors" onClick={() => setCurrentView('profile')}>
          <img src="https://i.pravatar.cc/150?u=admin" alt="User" className="w-9 h-9 md:w-10 md:h-10 rounded-full border border-border-strong" />
          <div className="flex flex-col hidden sm:flex">
            <div className="flex items-center gap-1">
              <span className="text-sm font-medium">{roleLabel}</span>
              <ChevronDown size={14} className="text-text-secondary" />
            </div>
            <span className="text-xs text-text-secondary">{userLabel} · {userHandle}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
