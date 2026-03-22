import React from 'react'

import Sidebar from '@/components/layout/Sidebar'
import TopHeader from '@/components/layout/TopHeader'
import { useSessionStore } from '@/store/sessionStore'
import { useUiStore } from '@/store/uiStore'

function AppShell({ children }) {
  const user = useSessionStore((state) => state.user)
  const isDarkMode = useUiStore((state) => state.isDarkMode)

  return (
    <div className={`layout-container lf-shell ${isDarkMode ? 'theme-dark' : ''}`} data-role={user?.role || 'guest'}>
      <Sidebar />
      <div className="main-wrapper lf-shell__main">
        <TopHeader />
        <main className="content-area lf-shell__content">{children}</main>
      </div>
    </div>
  )
}

export default AppShell
