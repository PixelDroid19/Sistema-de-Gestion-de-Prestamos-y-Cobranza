import React, { Suspense, lazy, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import AppShell from '@/components/layout/AppShell'
import { useSessionStore } from '@/store/sessionStore'
import { resolveCurrentView, useUiStore } from '@/store/uiStore'

import './App.scss'

const Home = lazy(() => import('@/pages/Home/Home'))
const Dashboard = lazy(() => import('@/pages/Dashboard/Dashboard'))
const Loans = lazy(() => import('@/pages/Loans/Loans'))
const Payments = lazy(() => import('@/pages/Payments/Payments'))
const Agents = lazy(() => import('@/pages/Agents/Agents'))
const Reports = lazy(() => import('@/pages/Reports/Reports'))
const Notifications = lazy(() => import('@/components/Notifications'))

const viewComponents = {
  Dashboard,
  Loans,
  Payments,
  Agents,
  Reports,
}

function ScreenFallback({ label }) {
  return <div className="state-panel app-page__fallback">{label}</div>
}

function App() {
  const { t } = useTranslation()
  const user = useSessionStore((state) => state.user)
  const bootstrapSession = useSessionStore((state) => state.bootstrapSession)
  const logout = useSessionStore((state) => state.logout)
  const currentView = useUiStore((state) => state.currentView)
  const setCurrentView = useUiStore((state) => state.setCurrentView)
  const isDarkMode = useUiStore((state) => state.isDarkMode)
  const notificationsOpen = useUiStore((state) => state.notificationsOpen)
  const setNotificationsOpen = useUiStore((state) => state.setNotificationsOpen)

  useEffect(() => {
    bootstrapSession()
  }, [bootstrapSession])

  useEffect(() => {
    const handleSessionExpired = () => {
      logout()
      window.alert(t('app.sessionExpired'))
    }

    window.addEventListener('sessionExpired', handleSessionExpired)

    return () => {
      window.removeEventListener('sessionExpired', handleSessionExpired)
    }
  }, [logout, t])

  const handleLogin = () => {
    setCurrentView('Dashboard')
  }

  useEffect(() => {
    if (!user) {
      return
    }

    const nextView = resolveCurrentView(currentView, user.role)
    if (nextView !== currentView) {
      setCurrentView(nextView)
    }
  }, [currentView, setCurrentView, user])

  if (!user) {
    return (
      <Suspense fallback={<ScreenFallback label={t('app.loadingHome')} />}>
        <Home onLogin={handleLogin} />
      </Suspense>
    )
  }

  const ActiveView = viewComponents[resolveCurrentView(currentView, user.role)] || Dashboard

  return (
    <div className={`app-page${isDarkMode ? ' app-page--dark' : ''}`}>
      <AppShell>
        <Suspense fallback={<ScreenFallback label={t('app.loadingWorkspace')} />}>
          <ActiveView user={user} />
        </Suspense>
      </AppShell>
      {notificationsOpen && (
        <Suspense fallback={null}>
          <Notifications user={user} isOpen={notificationsOpen} onClose={() => setNotificationsOpen(false)} />
        </Suspense>
      )}
    </div>
  )
}

export default App
