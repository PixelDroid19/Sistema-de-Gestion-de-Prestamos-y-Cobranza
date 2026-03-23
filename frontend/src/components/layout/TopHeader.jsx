import React from 'react'

import { Bell, ChevronDown, ChevronLeft, ChevronRight, Moon, Search, Settings, Sun } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import LanguageSwitcher from '@/components/layout/LanguageSwitcher'
import IconButton from '@/components/ui/IconButton'
import { useUnreadCountQuery } from '@/hooks/useNotifications'
import { useSessionStore } from '@/store/sessionStore'
import { resolveCurrentViewId, useUiStore } from '@/store/uiStore'

const TopHeader = () => {
  const { t } = useTranslation()
  const user = useSessionStore((state) => state.user)
  const isDarkMode = useUiStore((state) => state.isDarkMode)
  const toggleTheme = useUiStore((state) => state.toggleTheme)
  const setNotificationsOpen = useUiStore((state) => state.setNotificationsOpen)
  const setCurrentView = useUiStore((state) => state.setCurrentView)
  const currentView = useUiStore((state) => state.currentView)
  const searchQuery = useUiStore((state) => state.searchQuery)
  const setSearchQuery = useUiStore((state) => state.setSearchQuery)

  const unreadCountQuery = useUnreadCountQuery({
    enabled: Boolean(user),
    refetchInterval: user ? 30000 : false,
  })

  const unreadCount = unreadCountQuery.data?.data?.unreadCount || 0
  const currentDate = new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
  const resolvedView = user ? resolveCurrentViewId(currentView, user.role) : currentView

  return (
    <header className="top-header lf-top-header">
      <div className="lf-top-header__title-cluster">
        <button type="button" className="lf-top-header__workspace-chip">
          <span>{t(`shell.viewTitles.${resolvedView}`)}</span>
          <ChevronDown size={16} />
        </button>
      </div>
      <div className="search-bar">
        <Search className="search-icon-static" size={20} strokeWidth={2.5} />
        <input type="text" placeholder={t('shell.searchPlaceholder')} value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} />
      </div>
      <div className="header-actions">
        <LanguageSwitcher />
        <IconButton
          icon={Settings}
          title={t('shell.settings')}
          onClick={() => {
            if (user?.role === 'admin') {
              setCurrentView('config')
            }
          }}
        />
        <IconButton
          icon={isDarkMode ? Sun : Moon}
          title={t('shell.toggleTheme')}
          onClick={toggleTheme}
        />
        <button type="button" className="lf-top-header__notification-chip" onClick={() => setNotificationsOpen(true)}>
          <Bell size={16} />
          <span>{unreadCount > 0 ? t('shell.newNotifications', { count: unreadCount }) : t('shell.notifications')}</span>
        </button>
        <div className="lf-top-header__date-chip">
          <button type="button" aria-label={t('shell.previousDate')}><ChevronLeft size={16} /></button>
          <span>{currentDate}</span>
          <button type="button" aria-label={t('shell.nextDate')}><ChevronRight size={16} /></button>
        </div>
        <IconButton
          icon={Bell}
          title={t('shell.notifications')}
          onClick={() => setNotificationsOpen(true)}
          badge={unreadCount > 0 ? unreadCount : undefined}
        />
        <div className="user-profile" title={t('shell.userMenu')}>
          <div className="user-info">
            <span className="user-name">{user?.name}</span>
          </div>
          <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=${user?.name || 'user'}&backgroundColor=f1f5f9`} alt={t('shell.avatarAlt')} />
          <div className="user-info">
            <span className="user-role">{user?.role}</span>
          </div>
          <ChevronDown size={16} className="lf-top-header__profile-chevron" />
        </div>
      </div>
    </header>
  )
}

export default TopHeader
