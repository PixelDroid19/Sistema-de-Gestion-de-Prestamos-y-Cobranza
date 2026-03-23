import React, { Suspense, lazy, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import AppShell from '@/components/layout/AppShell'
import { useSessionStore } from '@/store/sessionStore'
import { resolveCurrentViewId, resolveViewComponentKey, useUiStore } from '@/store/uiStore'

import './App.scss'

const Home = lazy(() => import('@/pages/Home/Home'))
const Dashboard = lazy(() => import('@/pages/Dashboard/Dashboard'))
const Customers = lazy(() => import('@/pages/Customers/Customers'))
const NewCustomer = lazy(() => import('@/pages/Customers/NewCustomer'))
const Loans = lazy(() => import('@/pages/Loans/Loans'))
const NewLoan = lazy(() => import('@/pages/Loans/NewLoan'))
const Associates = lazy(() => import('@/pages/Associates/Associates'))
const Payments = lazy(() => import('@/pages/Payments/Payments'))
const Reports = lazy(() => import('@/pages/Reports/Reports'))
const Config = lazy(() => import('@/pages/Config/Config'))
const Notifications = lazy(() => import('@/components/Notifications'))

const viewComponents = {
  Dashboard,
  Customers,
  NewCustomer,
  Loans,
  NewLoan,
  Associates,
  Payments,
  Reports,
  Config,
  Notifications,
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
  const ensureAllowedView = useUiStore((state) => state.ensureAllowedView)
  const resolveAllowedView = ensureAllowedView || ((role) => resolveCurrentViewId(currentView, role))

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
    setCurrentView('dashboard')
  }

  useEffect(() => {
    if (!user) {
      return
    }

    const nextView = resolveAllowedView(user.role)
    if (nextView !== currentView) {
      setCurrentView(nextView)
    }
  }, [currentView, resolveAllowedView, setCurrentView, user])

  if (!user) {
    return (
      <Suspense fallback={<ScreenFallback label={t('app.loadingHome')} />}>
        <Home onLogin={handleLogin} />
      </Suspense>
    )
  }

  const resolvedView = resolveCurrentViewId(currentView, user.role)
  const ActiveView = viewComponents[resolveViewComponentKey(resolvedView, user.role)] || Dashboard
  const shouldRenderNotificationOverlay = notificationsOpen && resolvedView !== 'notifications'

  return (
    <div className={`app-page${isDarkMode ? ' app-page--dark' : ''}`}>
      <AppShell>
        <Suspense fallback={<ScreenFallback label={t('app.loadingWorkspace')} />}>
          <ActiveView user={user} />
        </Suspense>
      </AppShell>
      {shouldRenderNotificationOverlay && (
        <Suspense fallback={null}>
          <Notifications user={user} isOpen={notificationsOpen} onClose={() => setNotificationsOpen(false)} />
        </Suspense>
      )}
    </div>
  )
}

export default App
