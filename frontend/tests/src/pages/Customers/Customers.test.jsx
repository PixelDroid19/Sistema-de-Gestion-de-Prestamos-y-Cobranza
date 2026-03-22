import React from 'react'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'

import i18n from '@/i18n'
import NewCustomer from '@/pages/Customers/NewCustomer'
import Customers from '@/pages/Customers/Customers'
import { useUiStore } from '@/store/uiStore'
import { renderWithProviders } from '@tests/test/renderWithProviders'

const { mockUseCustomersQuery, mockCreateCustomerMutateAsync } = vi.hoisted(() => ({
  mockUseCustomersQuery: vi.fn(),
  mockCreateCustomerMutateAsync: vi.fn(),
}))

vi.mock('@/hooks/useCustomers', () => ({
  useCustomersQuery: (...args) => mockUseCustomersQuery(...args),
  useCreateCustomerMutation: () => ({
    mutateAsync: mockCreateCustomerMutateAsync,
    isPending: false,
  }),
}))

describe('Customers surfaces', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('es')
    useUiStore.setState({ currentView: 'customers', setCurrentView: vi.fn() })
    mockUseCustomersQuery.mockReset()
    mockCreateCustomerMutateAsync.mockReset()
  })

  it('renders the migrated customers workspace with live records', async () => {
    const setCurrentView = vi.fn()
    useUiStore.setState({ currentView: 'customers', setCurrentView })
    mockUseCustomersQuery.mockReturnValue({
      data: {
        items: [
          {
            id: 21,
            name: 'Laura Medina',
            email: 'laura@lendflow.test',
            phone: '+57 300 123 1234',
            status: 'active',
            activeLoans: 2,
            createdAt: '2026-03-15T00:00:00.000Z',
          },
        ],
      },
    })

    renderWithProviders(<Customers />)

    expect(mockUseCustomersQuery).toHaveBeenCalledWith({ pagination: { page: 1, pageSize: 50 } })
    expect(await screen.findByRole('heading', { name: 'Espacio de clientes' })).toBeInTheDocument()
    expect(screen.getByText('Laura Medina')).toBeInTheDocument()
    expect(screen.getByText('laura@lendflow.test')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Nuevo cliente' }))

    expect(setCurrentView).toHaveBeenCalledWith('customers-new')
  })

  it('submits the migrated new-customer form and returns to the listing', async () => {
    const user = userEvent.setup()
    const setCurrentView = vi.fn()
    useUiStore.setState({ currentView: 'customers-new', setCurrentView })
    mockCreateCustomerMutateAsync.mockResolvedValue({ data: { id: 41 } })

    renderWithProviders(<NewCustomer />)

    await user.type(screen.getByLabelText('Nombre completo'), 'Camila Torres')
    await user.type(screen.getByLabelText('Correo electronico'), 'camila@lendflow.test')
    await user.type(screen.getByLabelText('Telefono'), '+57 301 555 0101')
    await user.type(screen.getByLabelText('Numero de documento'), '123456789')

    await user.click(screen.getByRole('button', { name: 'Guardar cliente' }))

    await waitFor(() => {
      expect(mockCreateCustomerMutateAsync).toHaveBeenCalledWith({
        name: 'Camila Torres',
        email: 'camila@lendflow.test',
        phone: '+57 301 555 0101',
        documentNumber: '123456789',
        occupation: undefined,
        birthDate: undefined,
        address: undefined,
      })
    })
    expect(await screen.findByText('✅ Cliente creado correctamente.')).toBeInTheDocument()

    await waitFor(() => {
      expect(setCurrentView).toHaveBeenCalledWith('customers')
    }, { timeout: 1200 })
  })
})
