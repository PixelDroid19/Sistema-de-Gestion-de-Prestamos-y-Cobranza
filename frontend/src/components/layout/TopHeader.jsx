import React from 'react'

import { Bell, Moon, Search, Settings, Sun } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import LanguageSwitcher from '@/components/layout/LanguageSwitcher'
import IconButton from '@/components/ui/IconButton'
import { useUnreadCountQuery } from '@/hooks/useNotifications'
import { useSessionStore } from '@/store/sessionStore'
import { useUiStore } from '@/store/uiStore'

const TopHeader = () => {
  const { t } = useTranslation()
  const user = useSessionStore((state) => state.user)
  const isDarkMode = useUiStore((state) => state.isDarkMode)
  const toggleTheme = useUiStore((state) => state.toggleTheme)
  const setNotificationsOpen = useUiStore((state) => state.setNotificationsOpen)
  
  const unreadCountQuery = useUnreadCountQuery({
    enabled: Boolean(user),
    refetchInterval: user ? 30000 : false,
  });

  const unreadCount = unreadCountQuery.data?.data?.unreadCount || 0

  return (
    <header className="top-header">
      <div className="search-bar">
        <Search className="search-icon-static" size={20} strokeWidth={2.5} />
        <input type="text" placeholder={t('shell.searchPlaceholder')} />
      </div>
      <div className="header-actions">
        <LanguageSwitcher />
        <IconButton 
          icon={Settings} 
          title={t('shell.settings')} 
        />
        <IconButton 
          icon={isDarkMode ? Sun : Moon} 
          title={t('shell.toggleTheme')} 
          onClick={toggleTheme} 
        />
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
        </div>
      </div>
    </header>
  )
}

export default TopHeader
