import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, ChevronDown, Menu, Moon, Search, Sun } from 'lucide-react';
import { APP_BRAND, getRoleLabel, getShellDestinationsForUser } from '../constants/appShell';
import { getDefaultRouteForUser } from '../constants/appAccess';
import { useUnreadNotificationsCount } from '../services/notificationService';
import { safeLocalStorage } from '../lib/safeStorage';
import { useSessionStore } from '../store/sessionStore';

type HeaderProps = {
  setCurrentView: (view: string) => void;
  toggleMobileSidebar?: () => void;
};

export default function Header({ setCurrentView, toggleMobileSidebar }: HeaderProps) {
  const [isDark, setIsDark] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const { user } = useSessionStore();
  const { unreadCount } = useUnreadNotificationsCount();
  const searchRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const savedTheme = safeLocalStorage.getItem('theme');
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark');
      setIsDark(true);
    } else {
      document.documentElement.classList.remove('dark');
      setIsDark(false);
    }
  }, []);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!searchRef.current?.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  const toggleTheme = () => {
    if (isDark) {
      document.documentElement.classList.remove('dark');
      safeLocalStorage.setItem('theme', 'light');
      setIsDark(false);
      return;
    }

    document.documentElement.classList.add('dark');
    safeLocalStorage.setItem('theme', 'dark');
    setIsDark(true);
  };

  const shellDestinations = useMemo(() => getShellDestinationsForUser(user), [user]);
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const searchResults = useMemo(() => {
    if (!normalizedQuery) {
      return shellDestinations.slice(0, 6);
    }

    return shellDestinations
      .filter((item) => {
        const haystack = [
          item.label,
          item.description,
          ...(item.keywords || []),
        ]
          .join(' ')
          .toLowerCase();

        return haystack.includes(normalizedQuery);
      })
      .slice(0, 6);
  }, [normalizedQuery, shellDestinations]);

  const displayDate = new Intl.DateTimeFormat('es-CO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date());

  const userLabel = user?.name?.trim() || 'Usuario';
  const userHandle = user?.email || 'sin-correo';
  const roleLabel = getRoleLabel(user?.role);
  const homeView = getDefaultRouteForUser(user).replace(/^\//u, '');

  const goToDestination = (view: string) => {
    setCurrentView(view);
    setSearchQuery('');
    setIsSearchOpen(false);
  };

  const handleSearchSubmit = () => {
    if (searchResults.length === 0) {
      return;
    }

    goToDestination(searchResults[0].view);
  };

  return (
    <header className="min-h-16 shrink-0 border-b border-border-subtle bg-bg-surface px-3 py-3 sm:px-4 lg:px-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {toggleMobileSidebar && (
            <button
              className="rounded-lg p-2 text-text-secondary transition-colors hover:bg-hover-bg hover:text-text-primary md:hidden"
              onClick={toggleMobileSidebar}
              aria-label="Abrir menú"
            >
              <Menu size={24} />
            </button>
          )}

          <button
            type="button"
            className="hidden min-w-0 items-center gap-2 rounded-xl px-2 py-1 text-left transition-colors hover:bg-hover-bg sm:flex"
            onClick={() => setCurrentView(homeView)}
          >
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">
                {APP_BRAND.name}
              </span>
              <span className="truncate text-base font-semibold text-text-primary lg:text-lg">
                {APP_BRAND.workspace}
              </span>
            </div>
          </button>
        </div>

        <div className="flex min-w-0 items-center justify-end gap-2 sm:gap-3">
          <div ref={searchRef} className="relative hidden lg:block">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
            <input
              type="text"
              value={searchQuery}
              placeholder="Buscar módulo..."
              onFocus={() => setIsSearchOpen(true)}
              onChange={(event) => {
                setSearchQuery(event.target.value);
                setIsSearchOpen(true);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  handleSearchSubmit();
                }

                if (event.key === 'Escape') {
                  setIsSearchOpen(false);
                }
              }}
              className="w-[min(22rem,30vw)] rounded-full border border-border-subtle bg-bg-surface py-2 pl-10 pr-12 text-sm text-text-primary outline-none transition focus:border-border-strong focus:ring-1 focus:ring-border-strong"
              aria-expanded={isSearchOpen}
              aria-label="Buscar módulo"
            />
            <div className="pointer-events-none absolute right-3 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded bg-hover-bg text-[10px] text-text-secondary">
              ↵
            </div>

            {isSearchOpen && (
              <div className="absolute right-0 top-[calc(100%+0.75rem)] z-30 w-[min(26rem,42vw)] overflow-hidden rounded-2xl border border-border-subtle bg-bg-surface shadow-xl">
                <div className="border-b border-border-subtle px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">
                  {normalizedQuery ? 'Resultados' : 'Accesos rápidos'}
                </div>

                {searchResults.length > 0 ? (
                  <div className="p-2">
                    {searchResults.map((item) => (
                      <button
                        key={item.view}
                        type="button"
                        onClick={() => goToDestination(item.view)}
                        className="flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-hover-bg"
                      >
                        <div className="mt-0.5 rounded-lg bg-brand-primary/10 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-primary">
                          Ir
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-text-primary">{item.label}</div>
                          <div className="mt-1 text-xs leading-5 text-text-secondary">{item.description}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="px-4 py-5 text-sm text-text-secondary">
                    No encontré un módulo con ese criterio.
                  </div>
                )}
              </div>
            )}
          </div>

          <button
            onClick={toggleTheme}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border-subtle bg-bg-surface text-text-secondary transition-colors hover:bg-hover-bg hover:text-text-primary"
            title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
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

          <div className="hidden items-center rounded-full border border-border-subtle bg-bg-surface px-4 py-2 text-sm text-text-secondary 2xl:flex">
            Hoy · {displayDate}
          </div>

          <button
            type="button"
            className="flex min-w-0 items-center gap-2 rounded-xl p-1.5 transition-colors hover:bg-hover-bg md:gap-3 md:p-2"
            onClick={() => setCurrentView('profile')}
          >
            <img
              src="https://i.pravatar.cc/150?u=admin"
              alt="Usuario"
              className="h-9 w-9 shrink-0 rounded-full border border-border-strong md:h-10 md:w-10"
            />
            <div className="hidden min-w-0 max-w-[14rem] flex-col sm:flex">
              <div className="flex items-center gap-1">
                <span className="truncate text-sm font-medium">{roleLabel}</span>
                <ChevronDown size={14} className="shrink-0 text-text-secondary" />
              </div>
              <span className="truncate text-xs text-text-secondary">
                {userLabel} · {userHandle}
              </span>
            </div>
          </button>
        </div>
      </div>
    </header>
  );
}
