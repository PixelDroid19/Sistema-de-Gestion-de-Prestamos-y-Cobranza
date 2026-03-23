import React from 'react'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'

import i18n from '@/i18n'
import NewCustomer from '@/pages/Customers/NewCustomer'
import Customers from '@/pages/Customers/Customers'
import Loans from '@/pages/Loans/Loans'
import { useUiStore } from '@/store/uiStore'
import { renderWithProviders } from '@tests/test/renderWithProviders'

const {
  mockUseCustomersQuery,
  mockCreateCustomerMutateAsync,
  mockDeleteCustomerMutateAsync,
  mockUpdateCustomerMutateAsync,
  mockUploadCustomerDocumentMutateAsync,
  mockDeleteCustomerDocumentMutateAsync,
} = vi.hoisted(() => ({
  mockUseCustomersQuery: vi.fn(),
  mockCreateCustomerMutateAsync: vi.fn(),
  mockDeleteCustomerMutateAsync: vi.fn(),
  mockUpdateCustomerMutateAsync: vi.fn(),
  mockUploadCustomerDocumentMutateAsync: vi.fn(),
  mockDeleteCustomerDocumentMutateAsync: vi.fn(),
}))

vi.mock('@/hooks/useCustomers', () => ({
  useCustomersQuery: (...args) => mockUseCustomersQuery(...args),
  useCreateCustomerMutation: () => ({
    mutateAsync: mockCreateCustomerMutateAsync,
    isPending: false,
  }),
  useDeleteCustomerMutation: () => ({
    mutateAsync: mockDeleteCustomerMutateAsync,
    isPending: false,
  }),
  useUpdateCustomerMutation: () => ({
    mutateAsync: mockUpdateCustomerMutateAsync,
    isPending: false,
  }),
  useUploadCustomerDocumentMutation: () => ({
    mutateAsync: mockUploadCustomerDocumentMutateAsync,
    isPending: false,
  }),
  useDeleteCustomerDocumentMutation: () => ({
    mutateAsync: mockDeleteCustomerDocumentMutateAsync,
    isPending: false,
  }),
}))

describe('Customers surfaces', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('es')
    useUiStore.setState({ currentView: 'customers', setCurrentView: vi.fn() })
    mockUseCustomersQuery.mockReset()
    mockCreateCustomerMutateAsync.mockReset()
    mockDeleteCustomerMutateAsync.mockReset()
    mockUpdateCustomerMutateAsync.mockReset()
    mockUploadCustomerDocumentMutateAsync.mockReset()
    mockDeleteCustomerDocumentMutateAsync.mockReset()
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

    expect(mockUseCustomersQuery).toHaveBeenCalledWith({ pagination: { page: 1, pageSize: 10 } })
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
        phone: '+573015550101',
        documentNumber: '123456789',
        occupation: undefined,
        birthDate: undefined,
        department: undefined,
        city: undefined,
        status: 'active',
        address: undefined,
      })
    })
    expect(await screen.findByText('✅ Cliente creado correctamente.')).toBeInTheDocument()

    await waitFor(() => {
      expect(setCurrentView).toHaveBeenCalledWith('customers')
    }, { timeout: 1200 })
  })

  it('submits the new-customer form when the toolbar save button is clicked', async () => {
    const user = userEvent.setup()
    useUiStore.setState({ currentView: 'customers-new', setCurrentView: vi.fn() })
    mockCreateCustomerMutateAsync.mockResolvedValue({ data: { id: 52 } })

    renderWithProviders(<NewCustomer />)

    await user.type(screen.getByLabelText('Nombre completo'), 'Cliente Toolbar')
    await user.type(screen.getByLabelText('Correo electronico'), 'cliente.toolbar@example.com')

    await user.click(screen.getAllByRole('button', { name: 'Guardar cliente' })[0])

    await waitFor(() => {
      expect(mockCreateCustomerMutateAsync).toHaveBeenCalledWith(expect.objectContaining({
        name: 'Cliente Toolbar',
        email: 'cliente.toolbar@example.com',
      }))
    })
  })

  it('uses nested loanSummary fields when root loan counters are not present', async () => {
    mockUseCustomersQuery.mockReturnValue({
      data: {
        items: [
          {
            id: 22,
            name: 'Julia Rivera',
            email: 'julia@lendflow.test',
            phone: '+57 300 333 0000',
            status: 'active',
            loanSummary: {
              totalLoans: 3,
              activeLoans: 2,
              totalOutstandingBalance: 9800,
              latestLoanId: 120,
              latestLoanStatus: 'approved',
            },
            createdAt: '2026-03-12T00:00:00.000Z',
          },
        ],
      },
    })

    renderWithProviders(<Customers />)

    expect(await screen.findByText('Julia Rivera')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ver creditos' })).toBeInTheDocument()
  })

  it('keeps customer profile continuity from the list into editable profile details and related credits', async () => {
    const user = userEvent.setup()
    useUiStore.setState({
      currentView: 'customers',
      setCurrentView: (nextView) => useUiStore.setState({ currentView: nextView }),
      setLoanFilterCustomerId: (customerId) => useUiStore.setState({ loanFilterCustomerId: Number(customerId) }),
      setLoanDraftCustomerId: vi.fn(),
      setCustomerEditId: (customerId) => useUiStore.setState({ customerEditId: Number(customerId) }),
      clearCustomerEditId: () => useUiStore.setState({ customerEditId: null }),
      loanFilterCustomerId: null,
      customerEditId: null,
    })

    mockUseCustomersQuery.mockReturnValue({
      data: {
        items: [
          {
            id: 22,
            name: 'Julia Rivera',
            email: 'julia@lendflow.test',
            phone: '+57 300 333 0000',
            status: 'active',
            loanSummary: {
              totalLoans: 3,
              activeLoans: 2,
              totalOutstandingBalance: 9800,
              latestLoanId: 120,
              latestLoanStatus: 'approved',
            },
            createdAt: '2026-03-12T00:00:00.000Z',
          },
        ],
      },
    })

    renderWithProviders(<Customers />)

    expect(await screen.findByText('Julia Rivera')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Ver perfil' }))

    expect(await screen.findByText('Perfil de Julia Rivera')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Julia Rivera')).toBeInTheDocument()
    expect(screen.getByDisplayValue('julia@lendflow.test')).toBeInTheDocument()
    expect(screen.getByText('Creditos relacionados')).toBeInTheDocument()
    expect(screen.getByText('#120')).toBeInTheDocument()

    await user.clear(screen.getByDisplayValue('Julia Rivera'))
    await user.type(screen.getByLabelText('Nombre completo'), 'Julia Rivera Actualizada')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => {
      expect(mockUpdateCustomerMutateAsync).toHaveBeenCalledWith({
        customerId: 22,
        payload: {
          name: 'Julia Rivera Actualizada',
          email: 'julia@lendflow.test',
          phone: '+573003330000',
          status: 'active',
        },
      })
    })

    const profileCard = screen.getByText('Perfil de Julia Rivera').closest('section')
    await user.click(within(profileCard).getByRole('button', { name: 'Ver creditos' }))

    expect(useUiStore.getState().currentView).toBe('credits')
    expect(useUiStore.getState().loanFilterCustomerId).toBe(22)
    expect(useUiStore.getState().customerEditId).toBe(22)

    renderWithProviders(<Loans user={{ id: 1, role: 'admin', name: 'Ada Admin' }} />)

    expect(await screen.findByText('Mostrando cartera filtrada por cliente #22')).toBeInTheDocument()
  })
})
