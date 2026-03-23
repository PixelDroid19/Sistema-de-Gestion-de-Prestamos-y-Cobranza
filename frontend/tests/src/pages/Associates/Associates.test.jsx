import React from 'react'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'

import i18n from '@/i18n'
import Associates from '@/pages/Associates/Associates'
import { renderWithProviders } from '@tests/test/renderWithProviders'

const {
  mockUseAssociatesQuery,
  mockUseAssociateLoanCalendars,
  mockUseAssociatePortalQuery,
  mockUseCreateAssociateMutation,
  mockUseUpdateAssociateMutation,
  mockUseDeleteAssociateMutation,
  mockUseCreateContributionMutation,
  mockUseCreateDistributionMutation,
  mockUseCreateReinvestmentMutation,
  mockUseAssociateProfitabilityQuery,
} = vi.hoisted(() => ({
  mockUseAssociatesQuery: vi.fn(),
  mockUseAssociateLoanCalendars: vi.fn(),
  mockUseAssociatePortalQuery: vi.fn(),
  mockUseCreateAssociateMutation: vi.fn(),
  mockUseUpdateAssociateMutation: vi.fn(),
  mockUseDeleteAssociateMutation: vi.fn(),
  mockUseCreateContributionMutation: vi.fn(),
  mockUseCreateDistributionMutation: vi.fn(),
  mockUseCreateReinvestmentMutation: vi.fn(),
  mockUseAssociateProfitabilityQuery: vi.fn(),
}))

vi.mock('@/hooks/useAssociates', () => ({
  useAssociatesQuery: (...args) => mockUseAssociatesQuery(...args),
  useAssociateLoanCalendars: (...args) => mockUseAssociateLoanCalendars(...args),
  useAssociatePortalQuery: (...args) => mockUseAssociatePortalQuery(...args),
  useCreateAssociateMutation: () => mockUseCreateAssociateMutation(),
  useUpdateAssociateMutation: () => mockUseUpdateAssociateMutation(),
  useDeleteAssociateMutation: () => mockUseDeleteAssociateMutation(),
  useCreateAssociateContributionMutation: () => mockUseCreateContributionMutation(),
  useCreateAssociateDistributionMutation: () => mockUseCreateDistributionMutation(),
  useCreateAssociateReinvestmentMutation: () => mockUseCreateReinvestmentMutation(),
}))

vi.mock('@/hooks/useReports', () => ({
  useAssociateProfitabilityQuery: (...args) => mockUseAssociateProfitabilityQuery(...args),
}))

describe('Associates page', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('es')
    mockUseAssociatesQuery.mockReset()
    mockUseAssociateLoanCalendars.mockReturnValue([])
    mockUseAssociatePortalQuery.mockReturnValue({ data: { data: { portal: null } } })
    mockUseAssociateProfitabilityQuery.mockReturnValue({ data: { data: { report: null } } })
    const mutationStub = { mutateAsync: vi.fn(), isPending: false }
    mockUseCreateAssociateMutation.mockReturnValue(mutationStub)
    mockUseUpdateAssociateMutation.mockReturnValue(mutationStub)
    mockUseDeleteAssociateMutation.mockReturnValue(mutationStub)
    mockUseCreateContributionMutation.mockReturnValue(mutationStub)
    mockUseCreateDistributionMutation.mockReturnValue(mutationStub)
    mockUseCreateReinvestmentMutation.mockReturnValue(mutationStub)
  })

  it('renders the migrated associates workspace from the real query layer', async () => {
    mockUseAssociatesQuery.mockReturnValue({
      data: {
        items: [
          {
            id: 8,
            name: 'Socio Capital',
            email: 'socio@lendflow.test',
            status: 'active',
            participationPercentage: 35,
            activeLoanCount: 4,
          },
        ],
      },
    })

    renderWithProviders(<Associates />)

    expect(mockUseAssociatesQuery).toHaveBeenCalledWith({ pagination: { page: 1, pageSize: 10 } })
    expect(await screen.findByRole('heading', { name: 'Espacio de socios' })).toBeInTheDocument()
    expect(screen.getByText('Socio Capital')).toBeInTheDocument()
    expect(screen.getByText('35%')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Nuevo socio' })).toBeInTheDocument()
  })

  it('submits reinvestments from the associates workspace', async () => {
    const createReinvestment = vi.fn().mockResolvedValue({ data: { reinvestment: { id: 88 } } })

    mockUseAssociatesQuery.mockReturnValue({
      data: {
        items: [
          {
            id: 12,
            name: 'Partner One',
            email: 'partner@lendflow.test',
            phone: '3000000000',
            status: 'active',
            participationPercentage: '25.0000',
            activeLoanCount: 2,
          },
        ],
      },
    })
    mockUseAssociatePortalQuery.mockReturnValue({
      data: {
        data: {
          portal: {
            summary: {
              activeLoanCount: 2,
              portfolioExposure: '1500.00',
            },
            loans: [
              {
                id: 91,
                amount: 1500,
                status: 'active',
                customerName: 'Cliente Uno',
              },
            ],
          },
        },
      },
    })
    mockUseAssociateProfitabilityQuery.mockReturnValue({
      data: {
        data: {
          report: {
            summary: {
              totalContributed: '1000.00',
              totalDistributed: '150.00',
            },
            data: {
              distributions: [],
            },
          },
        },
      },
    })
    mockUseCreateReinvestmentMutation.mockReturnValue({ mutateAsync: createReinvestment, isPending: false })
    mockUseAssociateLoanCalendars.mockReturnValue([
      {
        data: {
          data: {
            calendar: {
              entries: [
                {
                  installmentNumber: 1,
                  dueDate: '2026-04-15T00:00:00.000Z',
                  outstandingAmount: 300,
                  status: 'pending',
                },
              ],
            },
          },
        },
        isLoading: false,
        isFetching: false,
        error: null,
      },
    ])

    renderWithProviders(<Associates />)

    expect(await screen.findByRole('heading', { name: 'Espacio de socios' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Detalle' }))

    expect(screen.getAllByText('Prestamos vinculados').length).toBeGreaterThan(0)
    expect(screen.getByText('Cliente Uno')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Aportes' }))

    expect(screen.getByText('Historial de aportes')).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('Monto de reinversion'), '80')
    await userEvent.type(screen.getByLabelText('Fecha de reinversion'), '2026-03-20')
    await userEvent.type(screen.getAllByLabelText('Notas')[2], 'Reinvertir utilidad del mes')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar reinversion' }))

    await waitFor(() => {
      expect(createReinvestment).toHaveBeenCalledWith({
        amount: '80',
        notes: 'Reinvertir utilidad del mes',
        contributionDate: undefined,
        distributionDate: undefined,
        reinvestmentDate: '2026-03-20',
      })
    })
    expect(await screen.findByText(/Movimiento de socio guardado correctamente\./)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Calendario' }))

    expect(screen.getByText('Calendario del inversionista')).toBeInTheDocument()
    expect(screen.getByText('Ir a pagos para marcar cuota')).toBeInTheDocument()
    expect(screen.getByText('Cliente Uno')).toBeInTheDocument()
  })
})
