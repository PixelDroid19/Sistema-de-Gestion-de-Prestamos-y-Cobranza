import { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, ChevronDown, Languages, Menu, Moon, Search, Sun } from 'lucide-react';
import { APP_BRAND, getAppBrandWorkspace, getRoleLabel, getShellDestinationsForUser } from '../constants/appShell';
import { getDefaultRouteForUser } from '../constants/appAccess';
import { useUnreadNotificationsCount } from '../services/notificationService';
import { useMyPermissions } from '../services/permissionsService';
import { tTerm } from '../i18n/terminology';
import { safeLocalStorage } from '../lib/safeStorage';
import { useSessionStore } from '../store/sessionStore';
import { AppInput, ClickableSurface, IconActionButton } from './shared/Surfaces';
import { useTranslation } from '../i18n';

type HeaderProps = {
  setCurrentView: (view: string) => void;
  toggleMobileSidebar?: () => void;
};

export default function Header({ setCurrentView, toggleMobileSidebar }: HeaderProps) {
  const { t, locale, setLocale } = useTranslation();
  const [isDark, setIsDark] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const { user } = useSessionStore();
  const { unreadCount } = useUnreadNotificationsCount();
  const { permissions: myPermissions } = useMyPermissions({ enabled: user?.role === 'employee' });
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

  const shellUser = useMemo(() => ({
    ...user,
    permissions: user?.role === 'employee' ? myPermissions : undefined,
  }), [myPermissions, user]);
  const shellDestinations = useMemo(() => getShellDestinationsForUser(shellUser), [locale, shellUser]);
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

  const userLabel = user?.name?.trim() || tTerm('header.user.fallbackName');
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
    <header className="app-glass-surface app-shell-header min-h-16 shrink-0 border-b border-border-subtle px-3 py-3 sm:px-4 lg:px-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {toggleMobileSidebar && (
            <IconActionButton
              className="md:hidden"
              onClick={toggleMobileSidebar}
              label={t('header.openMenu')}
              icon={<Menu size={24} />}
            />
          )}

          <ClickableSurface
            variant="list"
            className="hidden min-w-0 items-center rounded-xl px-2.5 py-1.5 text-left transition-colors hover:bg-hover-bg sm:flex"
            onClick={() => setCurrentView(homeView)}
            title={APP_BRAND.name}
          >
            <span className="truncate text-[0.95rem] font-semibold tracking-tight text-text-primary lg:text-base">
              {getAppBrandWorkspace()}
            </span>
          </ClickableSurface>
        </div>

        <div className="flex min-w-0 items-center justify-end gap-2 sm:gap-3">
          <div ref={searchRef} className="relative z-50 hidden lg:block">
            <AppInput
              variant="text"
              value={searchQuery}
              placeholder={t('header.searchModule')}
              onFocus={() => setIsSearchOpen(true)}
              onValueChange={(v, _detail, e) => {
                setSearchQuery(v);
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
              icon={<Search size={16} />}
              shellClassName="operational-control--header-search"
              className="w-[min(22rem,30vw)]"
              aria-expanded={isSearchOpen}
              aria-label={t('header.searchAriaLabel')}
            />
            <div className="pointer-events-none absolute right-3 top-1/2 z-10 flex size-5 -translate-y-1/2 items-center justify-center rounded bg-hover-bg text-[10px] text-text-secondary">
              ↵
            </div>

            {isSearchOpen && (
              <div className="absolute right-0 top-[calc(100%+0.75rem)] z-50 w-[min(26rem,42vw)] overflow-hidden rounded-2xl border border-border-subtle bg-bg-surface shadow-xl">
                <div className="border-b border-border-subtle px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">
                  {normalizedQuery ? tTerm('header.search.results') : tTerm('header.search.quickAccess')}
                </div>

                {searchResults.length > 0 ? (
                  <div className="p-2">
                    {searchResults.map((item) => (
                      <ClickableSurface
                        key={item.view}
                        variant="list"
                        onClick={() => goToDestination(item.view)}
                        className="flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-hover-bg"
                      >
                        <div className="mt-0.5 rounded-lg bg-brand-primary/10 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-primary">
                          {tTerm('header.search.go')}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-text-primary">{item.label}</div>
                          <div className="mt-1 text-xs leading-5 text-text-secondary">{item.description}</div>
                        </div>
                      </ClickableSurface>
                    ))}
                  </div>
                ) : (
                  <div className="px-4 py-5 text-sm text-text-secondary">
                    {tTerm('header.search.empty')}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 rounded-full border border-border-subtle bg-bg-surface/70 p-1">
            <IconActionButton
              onClick={toggleTheme}
              title={isDark ? t('header.lightMode') : t('header.darkMode')}
              label={isDark ? t('header.lightMode') : t('header.darkMode')}
              icon={isDark ? <Sun size={18} /> : <Moon size={18} />}
              className="rounded-full"
            />

            <IconActionButton
              onClick={() => setLocale(locale === 'es' ? 'en' : 'es')}
              title={t('header.languageSwitcher')}
              label={t('header.languageSwitcher')}
              icon={<Languages size={18} />}
              className="rounded-full"
            />

            <button
              type="button"
              onClick={() => setCurrentView('notifications')}
              className="action-button action-button--ghost relative h-9 w-9 !min-h-0 rounded-full !p-0"
              title={unreadCount > 0 ? tTerm('header.notifications.aria.new', { count: unreadCount }) : tTerm('header.notifications.aria.none')}
              aria-label={unreadCount > 0 ? tTerm('header.notifications.aria.new', { count: unreadCount }) : tTerm('header.notifications.aria.none')}
            >
              <span className="action-button-icon" aria-hidden="true"><Bell size={18} /></span>
              {unreadCount > 0 && (
                <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-bg-surface">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          </div>

          <span className="hidden h-7 w-px shrink-0 bg-border-subtle sm:block" aria-hidden="true" />

          <ClickableSurface
            variant="list"
            className="flex min-w-0 items-center gap-2.5 rounded-full p-1 pr-1 transition-colors hover:bg-hover-bg sm:pr-3"
            onClick={() => setCurrentView('profile')}
          >
            <img
              src="https://i.pravatar.cc/150?u=admin"
              alt={tTerm('header.user.avatarAlt')}
              className="size-9 shrink-0 rounded-full border border-border-strong object-cover"
            />
            <div className="hidden min-w-0 max-w-[12rem] flex-col sm:flex">
              <span className="truncate text-sm font-semibold leading-tight text-text-primary">{userLabel}</span>
              <span className="truncate text-xs leading-tight text-text-secondary">{roleLabel}</span>
            </div>
            <ChevronDown size={16} className="hidden shrink-0 text-text-secondary sm:block" />
          </ClickableSurface>
        </div>
      </div>
    </header>
  );
}
