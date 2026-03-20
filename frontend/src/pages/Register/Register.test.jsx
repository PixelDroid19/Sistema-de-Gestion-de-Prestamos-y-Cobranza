import React from 'react'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import i18n from '@/i18n'
import Register from '@/pages/Register/Register'
import { renderWithProviders } from '@/test/renderWithProviders'

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

  it('requires phone for agent registration and includes it in the payload', async () => {
    renderWithProviders(<Register onLogin={vi.fn()} />)

    await userEvent.type(screen.getByLabelText('Nombre completo'), 'Luis Agente')
    await userEvent.type(screen.getByLabelText('Correo electronico'), 'luis@lendflow.test')
    await userEvent.type(screen.getByLabelText('Contrasena'), 'secret123')
    await userEvent.selectOptions(screen.getByLabelText('Tipo de cuenta'), 'agent')
    await userEvent.type(screen.getByLabelText('Telefono'), '+57 311 222 3344')
    await userEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }))

    await waitFor(() => {
      expect(registerMutateAsync).toHaveBeenCalledWith({
        name: 'Luis Agente',
        email: 'luis@lendflow.test',
        password: 'secret123',
        role: 'agent',
        phone: '+57 311 222 3344',
      })
    })
  })
})
