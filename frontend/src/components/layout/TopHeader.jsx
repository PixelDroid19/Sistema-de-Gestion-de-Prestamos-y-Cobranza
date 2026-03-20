import React from 'react';
import { Search, Bell, Settings, Moon, Sun } from "lucide-react";
import { useSessionStore } from '../../store/sessionStore';
import { useUiStore } from '../../store/uiStore';
import { useUnreadCountQuery } from '../../hooks/useNotifications';
import IconButton from '../ui/IconButton';

const TopHeader = () => {
  const user = useSessionStore((state) => state.user);
  const isDarkMode = useUiStore((state) => state.isDarkMode);
  const toggleTheme = useUiStore((state) => state.toggleTheme);
  const setNotificationsOpen = useUiStore((state) => state.setNotificationsOpen);
  
  const unreadCountQuery = useUnreadCountQuery({
    enabled: Boolean(user),
    refetchInterval: user ? 30000 : false,
  });

  const unreadCount = unreadCountQuery.data?.data?.unreadCount || 0;

  return (
    <header className="top-header">
      <div className="search-bar">
        <Search className="search-icon-static" size={20} strokeWidth={2.5} />
        <input type="text" placeholder="SEARCH OR TYPE COMMAND" />
      </div>
      <div className="header-actions">
        <IconButton 
          icon={Settings} 
          title="Settings" 
        />
        <IconButton 
          icon={isDarkMode ? Sun : Moon} 
          title="Toggle Theme" 
          onClick={toggleTheme} 
        />
        <IconButton 
          icon={Bell} 
          title="Notifications" 
          onClick={() => setNotificationsOpen(true)}
          badge={unreadCount > 0 ? unreadCount : undefined}
        />
        <div className="user-profile" title="Click for options">
          <div className="user-info">
            <span className="user-name">{user?.name}</span>
          </div>
          <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=${user?.name || 'user'}&backgroundColor=f1f5f9`} alt="Avatar" />
        </div>
      </div>
    </header>
  );
};

export default TopHeader;
