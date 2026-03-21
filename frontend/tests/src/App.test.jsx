import React from 'react'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'

import i18n from '@/i18n'
import App from '@/pages/App/App'
import { API_BASE_URL } from '@/lib/api/client'
import { useSessionStore } from '@/store/sessionStore'
import { resolveCurrentView, useUiStore } from '@/store/uiStore'
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
      currentView: 'Payments',
      isDarkMode: false,
      notificationsOpen: false,
      setCurrentView: vi.fn(),
      toggleTheme: vi.fn(),
      setNotificationsOpen: vi.fn(),
    })
  })

  it('renders translated shell controls while mounting the active workspace page', async () => {
    let unreadCountRequests = 0

    server.use(
      http.get(`${API_BASE_URL}/api/notifications/unread-count`, () => {
        unreadCountRequests += 1
        return HttpResponse.json({ data: { unreadCount: 2 } })
      }),
      http.get(`${API_BASE_URL}/api/loans`, () => HttpResponse.json({
        data: {
          loans: [{
            id: 10,
            amount: 12000,
            interestRate: 12,
            termMonths: 12,
            status: 'approved',
            financialSnapshot: { installmentAmount: 1066.5, outstandingBalance: 8200 },
          }],
        },
      })),
    )

    renderWithProviders(<App />)

    expect(screen.getByPlaceholderText('Buscar en el espacio')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pagos' })).toBeInTheDocument()
    expect(await screen.findByText('Sigue la actividad de cuotas desde una sola superficie compartida')).toBeInTheDocument()
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
      currentView: 'Loans',
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

    expect(await screen.findByText('No hay prestamos pagables')).toBeInTheDocument()
  })

  it('normalizes a persisted disallowed view for the logged-in role', () => {
    expect(resolveCurrentView('Agents', 'customer')).toBe('Dashboard')
    expect(resolveCurrentView('Loans', 'customer')).toBe('Loans')
  })
})
