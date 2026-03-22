import React from 'react'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'

import i18n from '@/i18n'
import App from '@/pages/App/App'
import { API_BASE_URL } from '@/lib/api/client'
import { useSessionStore } from '@/store/sessionStore'
import { resolveCurrentViewId, useUiStore } from '@/store/uiStore'
import { renderWithProviders } from '@tests/test/renderWithProviders'
import { server } from '@tests/test/msw/server'

const adminUser = { id: 1, role: 'admin', name: 'Ada Admin' }
const customerUser = { id: 7, role: 'customer', name: 'Ana Customer' }

describe('App shell', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('es')

    useSessionStore.setState({
      user: adminUser,
      token: 'token-1',
      isReady: true,
      bootstrapSession: vi.fn(),
      logout: vi.fn(),
    })

    useUiStore.setState({
      currentView: 'payments',
      isDarkMode: false,
      notificationsOpen: false,
      setCurrentView: vi.fn(),
      toggleTheme: vi.fn(),
      setNotificationsOpen: vi.fn(),
    })
  })

  it('renders translated shell controls while mounting the active workspace page', async () => {
    useUiStore.setState({
      currentView: 'dashboard',
      isDarkMode: false,
      notificationsOpen: false,
      setCurrentView: vi.fn(),
      toggleTheme: vi.fn(),
      setNotificationsOpen: vi.fn(),
    })

    let unreadCountRequests = 0

    server.use(
      http.get(`${API_BASE_URL}/api/notifications/unread-count`, () => {
        unreadCountRequests += 1
        return HttpResponse.json({ data: { unreadCount: 2 } })
      }),
      http.get(`${API_BASE_URL}/api/reports/dashboard`, () => HttpResponse.json({
        data: {
          summary: {
            totalPortfolioAmount: 25000,
            totalRecoveredAmount: 12000,
            totalOutstandingAmount: 13000,
          },
        },
      })),
      http.get(`${API_BASE_URL}/api/loans`, () => HttpResponse.json({
        data: {
          loans: [],
        },
      })),
      http.get(`${API_BASE_URL}/api/payments`, () => HttpResponse.json({ data: [] })),
    )

    renderWithProviders(<App />)

    expect(screen.getByPlaceholderText('Buscar en el espacio')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Panel' })).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Mantiene prestamos, recuperacion y planeacion dentro de una sola cabina financiera' }, { timeout: 5000 })).toBeInTheDocument()
    expect(unreadCountRequests).toBe(1)
  })

  it('logs the user out and alerts when the session-expired event is raised', async () => {
    const logout = vi.fn()
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})

    useSessionStore.setState({
      user: adminUser,
      token: 'token-1',
      isReady: true,
      bootstrapSession: vi.fn(),
      logout,
    })

    server.use(
      http.get(`${API_BASE_URL}/api/notifications/unread-count`, () => HttpResponse.json({ data: { unreadCount: 0 } })),
      http.get(`${API_BASE_URL}/api/loans`, () => HttpResponse.json({ data: { loans: [] } })),
    )

    renderWithProviders(<App />)

    await screen.findByPlaceholderText('Buscar en el espacio')
    window.dispatchEvent(new Event('sessionExpired'))

    await waitFor(() => {
      expect(logout).toHaveBeenCalledTimes(1)
      expect(alertSpy).toHaveBeenCalledTimes(1)
    })
  })

  it('switches from Loans to Payments when the sidebar Pagos button is clicked', async () => {
    useSessionStore.setState({
      user: customerUser,
      token: 'token-customer',
      isReady: true,
      bootstrapSession: vi.fn(),
      logout: vi.fn(),
    })

    useUiStore.setState({
      currentView: 'loans',
      isDarkMode: false,
      notificationsOpen: false,
      setCurrentView: (nextView) => useUiStore.setState({ currentView: nextView }),
      toggleTheme: vi.fn(),
      setNotificationsOpen: vi.fn(),
    })

    server.use(
      http.get(`${API_BASE_URL}/api/notifications/unread-count`, () => HttpResponse.json({ data: { unreadCount: 0 } })),
      http.get(`${API_BASE_URL}/api/loans/customer/${customerUser.id}`, () => HttpResponse.json({ data: { loans: [] } })),
    )

    renderWithProviders(<App />)

    expect(await screen.findByText('Espacio de prestamos')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Pagos' }))

    await waitFor(() => {
      expect(useUiStore.getState().currentView).toBe('payments')
    })

    expect(screen.getByText('Espacio de pagos')).toBeInTheDocument()
  })

  it('normalizes a persisted disallowed view for the logged-in role', () => {
    expect(resolveCurrentViewId('Agents', 'customer')).toBe('dashboard')
    expect(resolveCurrentViewId('Loans', 'customer')).toBe('loans')
  })
})
