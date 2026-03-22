import React from 'react'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'

import i18n from '@/i18n'
import NewLoan from '@/pages/Loans/NewLoan'
import { useSessionStore } from '@/store/sessionStore'
import { useUiStore } from '@/store/uiStore'
import { renderWithProviders } from '@tests/test/renderWithProviders'

const {
  mockUseCustomersQuery,
  mockCreateLoanMutateAsync,
  mockSimulateLoanMutateAsync,
} = vi.hoisted(() => ({
  mockUseCustomersQuery: vi.fn(),
  mockCreateLoanMutateAsync: vi.fn(),
  mockSimulateLoanMutateAsync: vi.fn(),
}))

vi.mock('@/hooks/useCustomers', () => ({
  useCustomersQuery: (...args) => mockUseCustomersQuery(...args),
}))

vi.mock('@/hooks/useLoans', () => ({
  useCreateLoanMutation: () => ({ mutateAsync: mockCreateLoanMutateAsync, isPending: false }),
  useSimulateLoanMutation: () => ({ mutateAsync: mockSimulateLoanMutateAsync, isPending: false }),
}))

describe('New loan page', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('es')
    useSessionStore.setState({ user: { id: 1, role: 'admin', name: 'Ada Admin' }, token: 'token-1' })
    useUiStore.setState({ currentView: 'loans-new', setCurrentView: vi.fn() })
    mockUseCustomersQuery.mockReset()
    mockCreateLoanMutateAsync.mockReset()
    mockSimulateLoanMutateAsync.mockReset()
  })

  it('simulates and creates a loan from the migrated form surface', async () => {
    const user = userEvent.setup()
    const setCurrentView = vi.fn()
    useUiStore.setState({ currentView: 'loans-new', setCurrentView })
    mockUseCustomersQuery.mockReturnValue({ data: { items: [{ id: 5, name: 'Ana Cliente' }] } })
    mockSimulateLoanMutateAsync.mockResolvedValue({
      data: {
        simulation: {
          installmentAmount: 540.5,
          totalInterest: 486,
          totalPayable: 6486,
        },
      },
    })
    mockCreateLoanMutateAsync.mockResolvedValue({ data: { id: 88 } })

    renderWithProviders(<NewLoan />)

    expect(mockUseCustomersQuery).toHaveBeenCalledWith({ pagination: { page: 1, pageSize: 100 } })
    await user.selectOptions(screen.getByLabelText('Cliente'), '5')
    await user.type(screen.getByLabelText('Monto del prestamo'), '6000')
    await user.type(screen.getByLabelText('Tasa de interes'), '9')
    await user.type(screen.getByLabelText('Plazo en meses'), '12')

    await user.click(screen.getByRole('button', { name: 'Simular prestamo' }))

    await waitFor(() => {
      expect(mockSimulateLoanMutateAsync).toHaveBeenCalledWith({
        amount: 6000,
        interestRate: 9,
        termMonths: 12,
      })
    })
    expect(await screen.findByText('540.50')).toBeInTheDocument()
    expect(screen.getByText('6486.00')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Crear prestamo' }))

    await waitFor(() => {
      expect(mockCreateLoanMutateAsync).toHaveBeenCalledWith({
        customerId: 5,
        amount: 6000,
        interestRate: 9,
        termMonths: 12,
      })
    })
    expect(await screen.findByText('✅ Prestamo creado correctamente.')).toBeInTheDocument()

    await waitFor(() => {
      expect(setCurrentView).toHaveBeenCalledWith('loans')
    }, { timeout: 1200 })
  })
})
