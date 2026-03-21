import React from 'react'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import i18n from '@/i18n'
import Register from '@/pages/Register/Register'
import { renderWithProviders } from '@tests/test/renderWithProviders'

const registerMutateAsync = vi.fn()
const loginMutateAsync = vi.fn()

vi.mock('@/hooks/useAuth', () => ({
  useRegisterMutation: () => ({
    mutateAsync: registerMutateAsync,
    isPending: false,
  }),
  useLoginMutation: () => ({
    mutateAsync: loginMutateAsync,
    isPending: false,
  }),
}))

describe('Register page', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('es')
    registerMutateAsync.mockReset()
    loginMutateAsync.mockReset()
    registerMutateAsync.mockResolvedValue({})
    loginMutateAsync.mockResolvedValue({})
  })

  it('submits customer registration without phone and logs in after success', async () => {
    const onLogin = vi.fn()

    renderWithProviders(<Register onLogin={onLogin} />)

    await userEvent.type(screen.getByLabelText('Nombre completo'), 'Ana Cliente')
    await userEvent.type(screen.getByLabelText('Correo electronico'), 'ana@lendflow.test')
    await userEvent.type(screen.getByLabelText('Contrasena'), 'secret123')
    await userEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }))

    await waitFor(() => {
      expect(registerMutateAsync).toHaveBeenCalledWith({
        name: 'Ana Cliente',
        email: 'ana@lendflow.test',
        password: 'secret123',
        role: 'customer',
      })
      expect(loginMutateAsync).toHaveBeenCalledWith({ email: 'ana@lendflow.test', password: 'secret123' })
      expect(onLogin).toHaveBeenCalledTimes(1)
    })
  })

  it('keeps public registration limited to customer accounts', async () => {
    renderWithProviders(<Register onLogin={vi.fn()} />)

    expect(screen.getByLabelText('Tipo de cuenta')).toHaveValue('customer')
    expect(screen.queryByLabelText('Telefono')).not.toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('Nombre completo'), 'Luis Cliente')
    await userEvent.type(screen.getByLabelText('Correo electronico'), 'luis@lendflow.test')
    await userEvent.type(screen.getByLabelText('Contrasena'), 'secret123')
    await userEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }))

    await waitFor(() => {
      expect(registerMutateAsync).toHaveBeenCalledWith({
        name: 'Luis Cliente',
        email: 'luis@lendflow.test',
        password: 'secret123',
        role: 'customer',
      })
    })
  })

  it('renders a login switch action when the parent provides it', async () => {
    const onSwitchToLogin = vi.fn()

    renderWithProviders(<Register onLogin={vi.fn()} onSwitchToLogin={onSwitchToLogin} />)

    await userEvent.click(screen.getByRole('button', { name: 'Ya tienes cuenta? Ingresar' }))

    expect(onSwitchToLogin).toHaveBeenCalledTimes(1)
  })
})
