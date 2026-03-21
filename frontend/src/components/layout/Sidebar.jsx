import React from 'react'
import { Briefcase, CreditCard, LayoutDashboard, LogOut, PieChart, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { useSessionStore } from '@/store/sessionStore'
import { getAllowedViewsForRole, useUiStore } from '@/store/uiStore'

const MENU_ITEMS = {
  Dashboard: { labelKey: 'shell.views.Dashboard', icon: LayoutDashboard },
  Loans: { labelKey: 'shell.views.Loans', icon: Briefcase },
  Payments: { labelKey: 'shell.views.Payments', icon: CreditCard },
  Agents: { labelKey: 'shell.views.Agents', icon: Users },
  Reports: { labelKey: 'shell.views.Reports', icon: PieChart },
}

const Sidebar = () => {
  const { t } = useTranslation()
  const user = useSessionStore((state) => state.user)
  const logout = useSessionStore((state) => state.logout)
  const currentView = useUiStore((state) => state.currentView)
  const setCurrentView = useUiStore((state) => state.setCurrentView)

  const handleLogout = () => {
    logout()
  }

  const getMenuItems = () => {
    if (!user) return []

    return getAllowedViewsForRole(user.role).map((id) => {
      if (id === 'Reports' && user.role === 'socio') {
        return { id, label: t('shell.views.partnerPortal'), icon: PieChart }
      }

      return {
        id,
        label: t(MENU_ITEMS[id].labelKey),
        icon: MENU_ITEMS[id].icon,
      }
    })
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-brand__mark">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><path d="m9 11 3 3L22 4"></path></svg>
        </div>
      </div>
      <nav className="sidebar-nav">
        <ul>
          {getMenuItems().map(item => {
            const Icon = item.icon;
            return (
              <li key={item.id} className={currentView === item.id ? 'active' : ''}>
                <button
                  type="button"
                  className="sidebar-nav__button"
                  onClick={() => setCurrentView(item.id)}
                  title={item.label}
                  aria-label={item.label}
                >
                  <Icon size={22} strokeWidth={2.5} />
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
      
      <div className="sidebar-footer">
        <button
          onClick={handleLogout}
          className="icon-btn sidebar-logout"
          title={t('shell.logout')}
          aria-label={t('shell.logout')}
        >
          <LogOut size={18} />
        </button>
      </div>
    </aside>
  )
}

export default Sidebar
