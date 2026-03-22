import React from 'react'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { delay, http, HttpResponse } from 'msw'

import i18n from '@/i18n'
import { API_BASE_URL } from '@/lib/api/client'
import Reports from '@/pages/Reports/Reports'
import { usePaginationStore } from '@/store/paginationStore'
import { renderWithProviders } from '@tests/test/renderWithProviders'
import { server } from '@tests/test/msw/server'

const adminUser = { id: 1, role: 'admin', name: 'Ada Admin' }

const recoverySummaryResponse = {
  data: {
    summary: {
      totalLoans: 4,
      recoveredLoans: 0,
      outstandingLoans: 0,
      recoveryRate: '0%',
      totalRecoveredAmount: 0,
      totalOutstandingAmount: 0,
      totalLoansAmount: 45000,
    },
    recoveredLoans: [],
    outstandingLoans: [],
  },
}

describe('Reports page', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('es')
    usePaginationStore.setState({ scopes: {} })
  })

  it('loads tab-specific report data only when the user switches sections', async () => {
    const requests = {
      recovered: 0,
      outstanding: 0,
      users: 0,
    }

    server.use(
      http.get(`${API_BASE_URL}/api/reports/recovery`, async () => {
        await delay(80)
        return HttpResponse.json(recoverySummaryResponse)
      }),
      http.get(`${API_BASE_URL}/api/reports/profitability/customers`, () => {
        return HttpResponse.json({ data: { customers: [], pagination: { page: 1, pageSize: 25, totalItems: 0, totalPages: 0 } } })
      }),
      http.get(`${API_BASE_URL}/api/reports/profitability/loans`, () => {
        return HttpResponse.json({ data: { loans: [], pagination: { page: 1, pageSize: 25, totalItems: 0, totalPages: 0 } } })
      }),
      http.get(`${API_BASE_URL}/api/reports/recovered`, () => {
        requests.recovered += 1
        return HttpResponse.json({ data: { loans: [], pagination: { page: 1, pageSize: 25, totalItems: 0, totalPages: 0 } } })
      }),
      http.get(`${API_BASE_URL}/api/reports/outstanding`, () => {
        requests.outstanding += 1
        return HttpResponse.json({ data: { loans: [], pagination: { page: 1, pageSize: 25, totalItems: 0, totalPages: 0 } } })
      }),
      http.get(`${API_BASE_URL}/api/associates`, () => HttpResponse.json({ data: { associates: [], pagination: { page: 1, pageSize: 25, totalItems: 0, totalPages: 0 } } })),
      http.get(`${API_BASE_URL}/api/users`, () => {
        requests.users += 1
        return HttpResponse.json({ data: { users: [], pagination: { page: 1, pageSize: 25, totalItems: 0, totalPages: 0 } } })
      }),
    )

    renderWithProviders(<Reports user={adminUser} />)

    expect(screen.getByText('Cargando reportes')).toBeInTheDocument()
    expect(await screen.findByText('Espacio de reportes')).toBeInTheDocument()
    expect(screen.getByText('Saldos de cartera')).toBeInTheDocument()
    expect(requests).toEqual({ recovered: 0, outstanding: 0, users: 0 })

    await userEvent.click(screen.getByRole('button', { name: /Recuperados/i }))
    expect(await screen.findByText('Aun no hay prestamos recuperados')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /Pendientes/i }))
    expect(await screen.findByText('No hay prestamos pendientes')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /Usuarios/i }))
    expect(await screen.findByText('No se encontraron usuarios.')).toBeInTheDocument()
    expect(requests).toEqual({ recovered: 1, outstanding: 1, users: 1 })
  })

  it('retries the primary report query from the error panel', async () => {
    let recoveryAttempts = 0

    server.use(
      http.get(`${API_BASE_URL}/api/reports/recovery`, () => {
        recoveryAttempts += 1

        if (recoveryAttempts === 1) {
          return HttpResponse.json({ message: 'Broken' }, { status: 500 })
        }

        return HttpResponse.json(recoverySummaryResponse)
      }),
      http.get(`${API_BASE_URL}/api/reports/profitability/customers`, () => {
        return HttpResponse.json({ data: { customers: [], pagination: { page: 1, pageSize: 25, totalItems: 0, totalPages: 0 } } })
      }),
      http.get(`${API_BASE_URL}/api/reports/profitability/loans`, () => {
        return HttpResponse.json({ data: { loans: [], pagination: { page: 1, pageSize: 25, totalItems: 0, totalPages: 0 } } })
      }),
      http.get(`${API_BASE_URL}/api/reports/recovered`, () => HttpResponse.json({ data: { loans: [], pagination: { page: 1, pageSize: 25, totalItems: 0, totalPages: 0 } } })),
      http.get(`${API_BASE_URL}/api/reports/outstanding`, () => HttpResponse.json({ data: { loans: [], pagination: { page: 1, pageSize: 25, totalItems: 0, totalPages: 0 } } })),
      http.get(`${API_BASE_URL}/api/associates`, () => HttpResponse.json({ data: { associates: [], pagination: { page: 1, pageSize: 25, totalItems: 0, totalPages: 0 } } })),
    )

    renderWithProviders(<Reports user={adminUser} />)

    expect(await screen.findByText('No se pudieron cargar los reportes')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Intentar de nuevo' }))

    expect(await screen.findByText('Espacio de reportes')).toBeInTheDocument()
    expect(recoveryAttempts).toBe(2)
  })

  it('displays the customer credit profile after entering a customer id', async () => {
    server.use(
      http.get(`${API_BASE_URL}/api/reports/recovery`, () => HttpResponse.json(recoverySummaryResponse)),
      http.get(`${API_BASE_URL}/api/reports/profitability/customers`, () => {
        return HttpResponse.json({ data: { customers: [{ customerId: 7 }], pagination: { page: 1, pageSize: 25, totalItems: 1, totalPages: 1 } } })
      }),
      http.get(`${API_BASE_URL}/api/reports/profitability/loans`, () => {
        return HttpResponse.json({ data: { loans: [{ loanId: 11 }], pagination: { page: 1, pageSize: 25, totalItems: 1, totalPages: 1 } } })
      }),
      http.get(`${API_BASE_URL}/api/associates`, () => HttpResponse.json({ data: { associates: [], pagination: { page: 1, pageSize: 25, totalItems: 0, totalPages: 0 } } })),
      http.get(`${API_BASE_URL}/api/reports/customer-credit-profile/7`, () => {
        return HttpResponse.json({
          data: {
            customer: { id: 7, name: 'Ana Customer' },
            profile: {
              summary: {
                activeLoans: 2,
                delinquentAlerts: 1,
              },
              completeness: {
                isComplete: false,
                missingSections: ['supporting_documents', 'notifications'],
              },
            },
          },
        })
      }),
    )

    renderWithProviders(<Reports user={adminUser} />)

    expect(await screen.findByText('Espacio de reportes')).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('ID cliente'), '7')

    expect(await screen.findByText('Ana Customer')).toBeInTheDocument()
    expect(screen.getByText('Incompleto')).toBeInTheDocument()
    expect(screen.getByText('Secciones faltantes: supporting_documents, notifications')).toBeInTheDocument()
  })

  it('submits associate reinvestments from the reports workspace', async () => {
    const capturedRequests = []

    server.use(
      http.get(`${API_BASE_URL}/api/reports/recovery`, () => HttpResponse.json(recoverySummaryResponse)),
      http.get(`${API_BASE_URL}/api/reports/profitability/customers`, () => HttpResponse.json({ data: { customers: [], pagination: { page: 1, pageSize: 25, totalItems: 0, totalPages: 0 } } })),
      http.get(`${API_BASE_URL}/api/reports/profitability/loans`, () => HttpResponse.json({ data: { loans: [], pagination: { page: 1, pageSize: 25, totalItems: 0, totalPages: 0 } } })),
      http.get(`${API_BASE_URL}/api/associates`, () => HttpResponse.json({
        data: {
          associates: [
            { id: 12, name: 'Partner One', participationPercentage: '25.0000', status: 'active' },
          ],
          pagination: { page: 1, pageSize: 25, totalItems: 1, totalPages: 1 },
        },
      })),
      http.get(`${API_BASE_URL}/api/associates/12/portal`, () => HttpResponse.json({
        data: {
          portal: {
            summary: {
              activeLoanCount: 2,
              portfolioExposure: '1500.00',
            },
          },
        },
      })),
      http.get(`${API_BASE_URL}/api/reports/associates/profitability/12`, () => HttpResponse.json({
        data: {
          report: {
            summary: {
              totalContributed: '1000.00',
              totalDistributed: '150.00',
            },
          },
        },
      })),
      http.post(`${API_BASE_URL}/api/associates/12/reinvestments`, async ({ request }) => {
        capturedRequests.push(await request.json())
        return HttpResponse.json({ data: { reinvestment: { id: 88 } } }, { status: 201 })
      }),
    )

    renderWithProviders(<Reports user={adminUser} />)

    expect(await screen.findByText('Espacio de reportes')).toBeInTheDocument()

    const associateSection = screen.getByText('Gestionar socios, aportes y distribuciones').closest('section')
    const associateQueries = within(associateSection)

    await userEvent.selectOptions(associateQueries.getByLabelText('Socio seleccionado'), '12')
    await screen.findByDisplayValue('Partner One')

    await userEvent.type(associateQueries.getByLabelText('Monto de reinversion'), '80')
    await userEvent.type(associateQueries.getByLabelText('Fecha de reinversion'), '2026-03-20')
    await userEvent.type(associateQueries.getAllByLabelText('Notas')[2], 'Reinvertir utilidad del mes')
    await userEvent.click(associateQueries.getByRole('button', { name: 'Registrar reinversion' }))

    await waitFor(() => {
      expect(screen.getByText(/Reinversion creada correctamente\./)).toBeInTheDocument()
    })
    expect(capturedRequests).toEqual([
      {
        amount: '80',
        notes: 'Reinvertir utilidad del mes',
        reinvestmentDate: '2026-03-20',
      },
    ])
  })

  it('requests the next recovered page when pagination controls are used', async () => {
    const recoveredPages = []

    server.use(
      http.get(`${API_BASE_URL}/api/reports/recovery`, () => HttpResponse.json(recoverySummaryResponse)),
      http.get(`${API_BASE_URL}/api/reports/profitability/customers`, () => HttpResponse.json({ data: { customers: [], pagination: { page: 1, pageSize: 25, totalItems: 0, totalPages: 0 } } })),
      http.get(`${API_BASE_URL}/api/reports/profitability/loans`, () => HttpResponse.json({ data: { loans: [], pagination: { page: 1, pageSize: 25, totalItems: 0, totalPages: 0 } } })),
      http.get(`${API_BASE_URL}/api/associates`, () => HttpResponse.json({ data: { associates: [], pagination: { page: 1, pageSize: 25, totalItems: 0, totalPages: 0 } } })),
      http.get(`${API_BASE_URL}/api/reports/recovered`, ({ request }) => {
        const page = Number(new URL(request.url).searchParams.get('page') || '1')
        recoveredPages.push(page)
        return HttpResponse.json({
          data: {
            loans: page === 1 ? [{ id: 4, amount: 2000, totalPaid: 2000, updatedAt: '2026-03-01T00:00:00.000Z', Customer: { name: 'Loan A' } }] : [{ id: 5, amount: 2500, totalPaid: 2500, updatedAt: '2026-03-02T00:00:00.000Z', Customer: { name: 'Loan B' } }],
            pagination: { page, pageSize: 25, totalItems: 30, totalPages: 2 },
          },
        })
      }),
      http.get(`${API_BASE_URL}/api/reports/outstanding`, () => HttpResponse.json({ data: { loans: [], pagination: { page: 1, pageSize: 25, totalItems: 0, totalPages: 0 } } })),
      http.get(`${API_BASE_URL}/api/users`, () => HttpResponse.json({ data: { users: [], pagination: { page: 1, pageSize: 25, totalItems: 0, totalPages: 0 } } })),
    )

    renderWithProviders(<Reports user={adminUser} />)

    expect(await screen.findByText('Espacio de reportes')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /Recuperados/i }))
    expect(await screen.findByText('Loan A')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /Siguiente|Next/i }))

    expect(await screen.findByText('Loan B')).toBeInTheDocument()
    expect(recoveredPages).toEqual([1, 2])
  })
})
