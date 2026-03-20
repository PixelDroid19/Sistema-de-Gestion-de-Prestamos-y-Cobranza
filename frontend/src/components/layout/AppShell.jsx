import React from 'react'

import Sidebar from '@/components/layout/Sidebar'
import TopHeader from '@/components/layout/TopHeader'

function AppShell({ children }) {
  return (
    <div className="layout-container">
      <Sidebar />
      <div className="main-wrapper">
        <TopHeader />
        <main className="content-area">{children}</main>
      </div>
    </div>
  )
}

export default AppShell
