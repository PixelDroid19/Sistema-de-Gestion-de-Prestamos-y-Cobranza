import React from 'react'
import {
  Bell,
  Briefcase,
  ChevronDown,
  ChevronRight,
  CreditCard,
  LayoutDashboard,
  LogOut,
  PieChart,
  UserPlus,
  Users,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { useSessionStore } from '@/store/sessionStore'
import { getNavigationGroupsForRole, resolveCurrentViewId, useUiStore } from '@/store/uiStore'

const MENU_ITEMS = {
  dashboard: { labelKey: 'shell.views.Dashboard', icon: LayoutDashboard },
  customers: { labelKey: 'shell.views.Customers', icon: Users },
  'customers-new': { labelKey: 'shell.views.NewCustomer', icon: UserPlus },
  loans: { labelKey: 'shell.views.Loans', icon: Briefcase },
  'loans-new': { labelKey: 'shell.views.NewLoan', icon: CreditCard },
  associates: { labelKey: 'shell.views.Associates', icon: UserPlus },
  payments: { labelKey: 'shell.views.Payments', icon: CreditCard },
  agents: { labelKey: 'shell.views.Agents', icon: Users },
  reports: { labelKey: 'shell.views.Reports', icon: PieChart },
  notifications: { labelKey: 'shell.views.Notifications', icon: Bell },
}

const Sidebar = () => {
  const { t } = useTranslation()
  const user = useSessionStore((state) => state.user)
  const logout = useSessionStore((state) => state.logout)
  const currentView = useUiStore((state) => state.currentView)
  const setCurrentView = useUiStore((state) => state.setCurrentView)
  const navOpenGroups = useUiStore((state) => state.navOpenGroups)
  const toggleNavGroup = useUiStore((state) => state.toggleNavGroup)

  const handleLogout = () => {
    logout()
  }

  const navigationGroups = user ? getNavigationGroupsForRole(user.role) : []
  const activeView = user ? resolveCurrentViewId(currentView, user.role) : currentView

  return (
    <aside className="sidebar lf-sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-brand__mark">U</div>
        <div className="sidebar-brand__copy">
          <strong>{t('home.brand')}</strong>
          <span>{t('shell.brandCaption')}</span>
        </div>
      </div>
      <nav className="sidebar-nav">
        {navigationGroups.map((group) => {
          const isExpanded = navOpenGroups[group.id] !== false
          return (
            <div className="lf-sidebar__group" key={group.id}>
              <button type="button" className="lf-sidebar__group-toggle" aria-label={t('shell.toggleGroup', { group: t(group.labelKey) })} onClick={() => toggleNavGroup(group.id)}>
                <span>{t(group.labelKey)}</span>
                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
              {isExpanded ? (
                <ul className="lf-sidebar__group-list">
                  {group.items.map((item) => {
                    const config = MENU_ITEMS[item.id]
                    const Icon = config?.icon || Briefcase
                    const label = user.role === 'socio' && item.id === 'reports'
                      ? t('shell.views.partnerPortal')
                      : t(config.labelKey)
                    const active = activeView === item.id

                    return (
                      <li key={item.id} className={active ? 'active' : ''}>
                        <button
                          type="button"
                          className={`sidebar-nav__button lf-sidebar__button ${item.parent ? 'lf-sidebar__button--sub' : ''}`}
                          onClick={() => setCurrentView(item.id)}
                          aria-label={label}
                        >
                          <Icon size={18} strokeWidth={2} />
                          <span>{label}</span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              ) : null}
            </div>
          )
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="lf-sidebar__profile">
          <span className="lf-sidebar__profile-name">{user?.name || 'Workspace'}</span>
          <span className="lf-sidebar__profile-role">{user?.role || 'guest'}</span>
        </div>
        <button
          onClick={handleLogout}
          className="icon-btn sidebar-logout lf-sidebar__logout"
          title={t('shell.logout')}
          aria-label={t('shell.logout')}
        >
          <LogOut size={18} />
          <span>{t('shell.logout')}</span>
        </button>
      </div>
    </aside>
  )
}

export default Sidebar
