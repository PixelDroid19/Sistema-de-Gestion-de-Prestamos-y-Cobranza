import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nextProvider } from 'react-i18next'

import i18n from '@/i18n'
import Sidebar from '@/components/layout/Sidebar'
import { useSessionStore } from '@/store/sessionStore'
import { getNavigationGroupsForRole, useUiStore } from '@/store/uiStore'

describe('Sidebar', () => {
  beforeEach(() => {
    useSessionStore.setState({ user: { role: 'admin', name: 'Admin' }, logout: vi.fn() })
    useUiStore.setState({ currentView: 'dashboard', setCurrentView: vi.fn() })
    i18n.changeLanguage('es')
  })

  it('renders navigation buttons with translated labels', async () => {
    const setCurrentView = vi.fn()
    useUiStore.setState({ currentView: 'dashboard', setCurrentView })

    render(
      <I18nextProvider i18n={i18n}>
        <Sidebar />
      </I18nextProvider>,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Pagos' }))
    expect(setCurrentView).toHaveBeenCalledWith('credits-payments')
  })

  it('keeps admin navigation aligned with the final role-gated workspaces', () => {
    expect(getNavigationGroupsForRole('admin')).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'overview', items: [expect.objectContaining({ id: 'dashboard' })] }),
      expect.objectContaining({ id: 'customers', items: [expect.objectContaining({ id: 'customers' }), expect.objectContaining({ id: 'customers-new' })] }),
      expect.objectContaining({ id: 'credits', items: [expect.objectContaining({ id: 'credits' }), expect.objectContaining({ id: 'credits-new' }), expect.objectContaining({ id: 'credits-payments' })] }),
      expect.objectContaining({ id: 'partners', items: [expect.objectContaining({ id: 'partners' }), expect.objectContaining({ id: 'partners-reports' })] }),
      expect.objectContaining({ id: 'system', items: [expect.objectContaining({ id: 'notifications' })] }),
    ]))
  })

  it('limits socio navigation and delegates logout to the session store', async () => {
    const logout = vi.fn()
    useSessionStore.setState({ user: { role: 'socio', name: 'Partner' }, logout })
    useUiStore.setState({ currentView: 'dashboard', setCurrentView: vi.fn() })

    render(
      <I18nextProvider i18n={i18n}>
        <Sidebar />
      </I18nextProvider>,
    )

    expect(screen.queryByRole('button', { name: 'Pagos' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Agentes' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Portal de socios' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Cerrar sesion' }))

    expect(logout).toHaveBeenCalledTimes(1)
  })
})
