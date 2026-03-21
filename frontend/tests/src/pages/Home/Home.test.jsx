import React from 'react'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import i18n from '@/i18n'
import Home from '@/pages/Home/Home'
import { renderWithProviders } from '@tests/test/renderWithProviders'

const mutateAsync = vi.fn()

vi.mock('@/hooks/useAuth', () => ({
  useLoginMutation: () => ({
    mutateAsync,
    isPending: false,
  }),
  useRegisterMutation: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}))

describe('Home page', () => {
  beforeEach(async () => {
    mutateAsync.mockReset()
    mutateAsync.mockResolvedValue({})
    await i18n.changeLanguage('es')
  })

  it('shows the landing by default and returns to it after leaving the login flow', async () => {
    renderWithProviders(<Home onLogin={vi.fn()} />)

    expect(screen.getByRole('heading', { name: /Gestion de prestamos, reimaginada\./i })).toBeInTheDocument()
    expect(screen.queryByLabelText('Correo electronico')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }))

    expect(await screen.findByLabelText('Correo electronico')).toBeInTheDocument()
    expect(screen.getByLabelText('Contrasena')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Volver al inicio' }))

    expect(screen.getByRole('heading', { name: /Gestion de prestamos, reimaginada\./i })).toBeInTheDocument()
    expect(screen.queryByLabelText('Correo electronico')).not.toBeInTheDocument()
  })

  it('switches the hero auth panel to registration mode from the header CTA', async () => {
    renderWithProviders(<Home onLogin={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: 'Registrarse' }))

    expect(await screen.findByLabelText('Nombre completo')).toBeInTheDocument()
    expect(screen.getByLabelText('Tipo de cuenta')).toBeInTheDocument()
  })

  it('submits login credentials and calls onLogin after success', async () => {
    const onLogin = vi.fn()

    renderWithProviders(<Home onLogin={onLogin} />)

    await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }))
    await userEvent.type(screen.getByLabelText('Correo electronico'), 'ops@lendflow.test')
    await userEvent.type(screen.getByLabelText('Contrasena'), 'secret123')
    await userEvent.click(screen.getAllByRole('button', { name: 'Ingresar' }).at(-1))

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({ email: 'ops@lendflow.test', password: 'secret123' })
      expect(onLogin).toHaveBeenCalledTimes(1)
    })
  })

  it('surfaces login failures without triggering the authenticated callback', async () => {
    const onLogin = vi.fn()
    mutateAsync.mockRejectedValueOnce(new Error('Credenciales invalidas'))

    renderWithProviders(<Home onLogin={onLogin} />)

    await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }))
    await userEvent.type(screen.getByLabelText('Correo electronico'), 'ops@lendflow.test')
    await userEvent.type(screen.getByLabelText('Contrasena'), 'wrong-password')
    await userEvent.click(screen.getAllByRole('button', { name: 'Ingresar' }).at(-1))

    expect(await screen.findByText('Credenciales invalidas')).toBeInTheDocument()
    expect(onLogin).not.toHaveBeenCalled()
  })

  it('lets the user switch from login to registration without leaving the auth panel', async () => {
    renderWithProviders(<Home onLogin={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }))
    await userEvent.click(screen.getByRole('button', { name: 'Necesitas una cuenta? Registrate' }))

    expect(await screen.findByLabelText('Nombre completo')).toBeInTheDocument()
  })
})
