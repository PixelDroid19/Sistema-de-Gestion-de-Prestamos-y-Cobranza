import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nextProvider } from 'react-i18next'

import i18n from '@/i18n'
import Sidebar from '@/components/layout/Sidebar'
import { useSessionStore } from '@/store/sessionStore'
import { useUiStore } from '@/store/uiStore'

describe('Sidebar', () => {
  beforeEach(() => {
    useSessionStore.setState({ user: { role: 'admin', name: 'Admin' }, logout: vi.fn() })
    useUiStore.setState({ currentView: 'Dashboard', setCurrentView: vi.fn() })
    i18n.changeLanguage('es')
  })

  it('renders navigation buttons with translated labels', async () => {
    const setCurrentView = vi.fn()
    useUiStore.setState({ currentView: 'Dashboard', setCurrentView })

    render(
      <I18nextProvider i18n={i18n}>
        <Sidebar />
      </I18nextProvider>,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Pagos' }))
    expect(setCurrentView).toHaveBeenCalledWith('Payments')
  })
})
