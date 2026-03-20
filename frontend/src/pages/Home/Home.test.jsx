import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nextProvider } from 'react-i18next'

import i18n from '@/i18n'
import Home from '@/pages/Home/Home'

const mutateAsync = vi.fn()

vi.mock('@/hooks/useAuth', () => ({
  useLoginMutation: () => ({
    mutateAsync,
    isPending: false,
  }),
}))

vi.mock('@/pages/Register/Register', () => ({
  default: () => <div>Register form</div>,
}))

describe('Home page', () => {
  beforeEach(() => {
    mutateAsync.mockReset()
    mutateAsync.mockResolvedValue({})
    i18n.changeLanguage('es')
  })

  it('renders landing content from translations', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <Home onLogin={vi.fn()} />
      </I18nextProvider>,
    )

    expect(screen.getByRole('heading', { name: /Gestion de prestamos, reimaginada\./i })).toBeInTheDocument()
    expect(screen.getByText('La plataforma integral premium para administrar originaciones, cobranzas y seguimiento de clientes con maxima precision y elegancia.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Protege tu cartera/i })).toBeInTheDocument()
    expect(screen.getByText('Prestamos Gestionados')).toBeInTheDocument()
    expect(screen.getByText('Ubicaciones')).toBeInTheDocument()
  })

  it('opens translated registration view from the header CTA', async () => {
    render(
      <I18nextProvider i18n={i18n}>
        <Home onLogin={vi.fn()} />
      </I18nextProvider>,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Registrarse' }))
    expect(screen.getByText('Register form')).toBeInTheDocument()
  })

  it('submits login credentials and calls onLogin after success', async () => {
    const onLogin = vi.fn()

    render(
      <I18nextProvider i18n={i18n}>
        <Home onLogin={onLogin} />
      </I18nextProvider>,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }))
    await userEvent.type(screen.getByLabelText('Correo electronico'), 'ops@lendflow.test')
    await userEvent.type(screen.getByLabelText('Contrasena'), 'secret123')
    await userEvent.click(screen.getAllByRole('button', { name: 'Ingresar' }).at(-1))

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({ email: 'ops@lendflow.test', password: 'secret123' })
      expect(onLogin).toHaveBeenCalledTimes(1)
    })
  })
})
