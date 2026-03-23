import React from 'react'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { delay, http, HttpResponse } from 'msw'
import { vi } from 'vitest'

import i18n from '@/i18n'
import { API_BASE_URL } from '@/lib/api/client'
import * as downloadModule from '@/lib/api/download'
import Reports from '@/pages/Reports/Reports'
import { usePaginationStore } from '@/store/paginationStore'
import { renderWithProviders } from '@tests/test/renderWithProviders'
import { server } from '@tests/test/msw/server'

const adminUser = { id: 1, role: 'admin', name: 'Ada Admin' }

const hasOwnTextContent = (text) => (_, element) => {
  const normalizedText = element?.textContent?.replace(/\s+/g, ' ').trim() ?? ''
  const childHasExactText = Array.from(element?.children ?? []).some((child) => {
    const childText = child.textContent?.replace(/\s+/g, ' ').trim() ?? ''
    return childText === text
  })

  return normalizedText === text && !childHasExactText
}

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
    vi.restoreAllMocks()
  })

  it('loads tab-specific report data only when the user switches sections', async () => {
    const requests = {
      recovered: 0,
      outstanding: 0,
      users: 0,
      associates: 0,
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
      http.get(`${API_BASE_URL}/api/associates`, () => {
        requests.associates += 1
        return HttpResponse.json({ data: { associates: [], pagination: { page: 1, pageSize: 25, totalItems: 0, totalPages: 0 } } })
      }),
      http.get(`${API_BASE_URL}/api/users`, () => {
        requests.users += 1
        return HttpResponse.json({ data: { users: [], pagination: { page: 1, pageSize: 25, totalItems: 0, totalPages: 0 } } })
      }),
    )

    renderWithProviders(<Reports user={adminUser} />)

    expect(screen.getByText('Cargando reportes')).toBeInTheDocument()
    expect(await screen.findByText('Espacio de reportes')).toBeInTheDocument()
    expect(screen.getByText('Saldos de cartera')).toBeInTheDocument()
    expect(screen.queryByText('Gestionar socios, aportes y distribuciones')).not.toBeInTheDocument()
    expect(screen.queryByText('Roster asignado')).not.toBeInTheDocument()
    expect(requests).toEqual({ recovered: 0, outstanding: 0, users: 0, associates: 0 })

    await userEvent.click(screen.getByRole('button', { name: /Recuperados/i }))
    expect(await screen.findByText('Aun no hay prestamos recuperados')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /Pendientes/i }))
    expect(await screen.findByText('No hay prestamos pendientes')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /Usuarios/i }))
    expect(await screen.findByText('No se encontraron usuarios.')).toBeInTheDocument()
    expect(requests).toEqual({ recovered: 1, outstanding: 1, users: 1, associates: 0 })
  })

  it('labels recovery-owner columns without legacy roster wording', async () => {
    server.use(
      http.get(`${API_BASE_URL}/api/reports/recovery`, () => HttpResponse.json(recoverySummaryResponse)),
      http.get(`${API_BASE_URL}/api/reports/profitability/customers`, () => HttpResponse.json({ data: { customers: [], pagination: { page: 1, pageSize: 25, totalItems: 0, totalPages: 0 } } })),
      http.get(`${API_BASE_URL}/api/reports/profitability/loans`, () => HttpResponse.json({ data: { loans: [], pagination: { page: 1, pageSize: 25, totalItems: 0, totalPages: 0 } } })),
      http.get(`${API_BASE_URL}/api/reports/recovered`, () => HttpResponse.json({
        data: {
          loans: [{ id: 4, amount: 2000, totalPaid: 2000, updatedAt: '2026-03-01T00:00:00.000Z', Customer: { name: 'Loan A' }, Agent: { name: 'Miles Agent' } }],
          pagination: { page: 1, pageSize: 25, totalItems: 1, totalPages: 1 },
        },
      })),
      http.get(`${API_BASE_URL}/api/reports/outstanding`, () => HttpResponse.json({
        data: {
          loans: [{ id: 5, amount: 2500, totalPaid: 500, outstandingAmount: 2000, recoveryStatus: 'in_progress', Customer: { name: 'Loan B' }, Agent: { name: 'Miles Agent' } }],
          pagination: { page: 1, pageSize: 25, totalItems: 1, totalPages: 1 },
        },
      })),
      http.get(`${API_BASE_URL}/api/associates`, () => HttpResponse.json({ data: { associates: [], pagination: { page: 1, pageSize: 25, totalItems: 0, totalPages: 0 } } })),
    )

    renderWithProviders(<Reports user={adminUser} />)

    expect(await screen.findByText('Espacio de reportes')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /Recuperados/i }))
    expect(await screen.findByText('Miles Agent')).toBeInTheDocument()
    expect(screen.getByText('Responsable de recuperacion')).toBeInTheDocument()
    expect(screen.queryByText('Roster asignado')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /Pendientes/i }))
    expect(await screen.findByText('Loan B')).toBeInTheDocument()
    expect(screen.getByText('Responsable de recuperacion')).toBeInTheDocument()
    expect(screen.queryByText('Roster asignado')).not.toBeInTheDocument()
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

  it('keeps reports focused on analytics instead of associate operations', async () => {
    let associateRequests = 0

    server.use(
      http.get(`${API_BASE_URL}/api/reports/recovery`, () => HttpResponse.json(recoverySummaryResponse)),
      http.get(`${API_BASE_URL}/api/reports/profitability/customers`, () => HttpResponse.json({ data: { customers: [], pagination: { page: 1, pageSize: 25, totalItems: 0, totalPages: 0 } } })),
      http.get(`${API_BASE_URL}/api/reports/profitability/loans`, () => HttpResponse.json({ data: { loans: [], pagination: { page: 1, pageSize: 25, totalItems: 0, totalPages: 0 } } })),
      http.get(`${API_BASE_URL}/api/associates`, () => {
        associateRequests += 1
        return HttpResponse.json({ data: { associates: [], pagination: { page: 1, pageSize: 25, totalItems: 0, totalPages: 0 } } })
      }),
    )

    renderWithProviders(<Reports user={adminUser} />)

    expect(await screen.findByText('Espacio de reportes')).toBeInTheDocument()
    expect(screen.getByText('Analitica de recuperacion, rentabilidad de clientes y cartera viven juntas en la misma pagina respaldada por TanStack Query.')).toBeInTheDocument()
    expect(screen.queryByText('Gestionar socios, aportes y distribuciones')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Exportar datos del socio' })).not.toBeInTheDocument()
    expect(associateRequests).toBe(0)
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

  it('executes report exports and completes user-management actions from the live admin workspace', async () => {
    const exportSpy = vi.spyOn(downloadModule, 'downloadFile').mockResolvedValue(new Blob(['report']))
    const rolePayloads = []
    const deactivatedUsers = []
    const reactivatedUsers = []
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

    server.use(
      http.get(`${API_BASE_URL}/api/reports/recovery`, () => HttpResponse.json(recoverySummaryResponse)),
      http.get(`${API_BASE_URL}/api/reports/profitability/customers`, () => HttpResponse.json({ data: { customers: [], pagination: { page: 1, pageSize: 25, totalItems: 0, totalPages: 0 } } })),
      http.get(`${API_BASE_URL}/api/reports/profitability/loans`, () => HttpResponse.json({ data: { loans: [], pagination: { page: 1, pageSize: 25, totalItems: 0, totalPages: 0 } } })),
      http.get(`${API_BASE_URL}/api/reports/recovered`, () => HttpResponse.json({ data: { loans: [], pagination: { page: 1, pageSize: 25, totalItems: 0, totalPages: 0 } } })),
      http.get(`${API_BASE_URL}/api/reports/outstanding`, () => HttpResponse.json({ data: { loans: [], pagination: { page: 1, pageSize: 25, totalItems: 0, totalPages: 0 } } })),
      http.get(`${API_BASE_URL}/api/reports/credit-history/loan/91`, () => HttpResponse.json({
        data: {
          history: {
            loan: { id: 91 },
            snapshot: { outstandingBalance: 200, totalPaid: 800 },
            payments: [],
            payoffHistory: [],
            closure: { closureReason: null },
          },
        },
      })),
      http.get(`${API_BASE_URL}/api/reports/customer-credit-profile/7`, () => HttpResponse.json({
        data: {
          customer: { id: 7, name: 'Ana Customer' },
          profile: {
            summary: { activeLoans: 1, delinquentAlerts: 0 },
            completeness: { isComplete: true, missingSections: [] },
          },
        },
      })),
      http.get(`${API_BASE_URL}/api/users`, () => HttpResponse.json({
        data: {
          users: [
            { id: 3, name: 'Carla Customer', email: 'carla@lendflow.test', role: 'customer', isActive: true },
            { id: 4, name: 'Sam Socio', email: 'sam@lendflow.test', role: 'socio', isActive: false },
          ],
          pagination: { page: 1, pageSize: 25, totalItems: 2, totalPages: 1 },
        },
      })),
      http.put(`${API_BASE_URL}/api/users/3`, async ({ request }) => {
        rolePayloads.push(await request.json())
        return HttpResponse.json({ data: { id: 3, role: 'admin' } })
      }),
      http.post(`${API_BASE_URL}/api/users/3/deactivate`, () => {
        deactivatedUsers.push(3)
        return HttpResponse.json({ data: { success: true } })
      }),
      http.post(`${API_BASE_URL}/api/users/4/reactivate`, () => {
        reactivatedUsers.push(4)
        return HttpResponse.json({ data: { success: true } })
      }),
    )

    renderWithProviders(<Reports user={adminUser} />)

    expect(await screen.findByText('Espacio de reportes')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Exportar CSV' }))
    await userEvent.click(screen.getByRole('button', { name: 'Exportar PDF' }))
    await userEvent.type(screen.getByLabelText('ID prestamo'), '91')
    await userEvent.type(screen.getByLabelText('ID cliente'), '7')
    await userEvent.click(screen.getByRole('button', { name: 'Descargar reporte del prestamo' }))
    await userEvent.click(screen.getByRole('button', { name: 'Descargar reporte del cliente' }))

    expect(exportSpy).toHaveBeenNthCalledWith(1, expect.objectContaining({ filename: 'recovery-report.csv' }))
    expect(exportSpy).toHaveBeenNthCalledWith(2, expect.objectContaining({ filename: 'recovery-report.pdf' }))
    expect(exportSpy).toHaveBeenNthCalledWith(3, expect.objectContaining({ filename: 'loan-91-credit-history.pdf' }))
    expect(exportSpy).toHaveBeenNthCalledWith(4, expect.objectContaining({ filename: 'customer-7-credit-profile.pdf' }))

    await userEvent.click(screen.getByRole('button', { name: /Usuarios/i }))
    expect(await screen.findByText('Carla Customer')).toBeInTheDocument()

    const carlaRow = screen.getByText('Carla Customer').closest('tr')
    const samRow = screen.getByText('Sam Socio').closest('tr')

    await userEvent.click(within(carlaRow).getByRole('button', { name: 'Editar rol' }))
    await userEvent.selectOptions(within(carlaRow).getByRole('combobox'), 'admin')
    await userEvent.click(within(carlaRow).getByRole('button', { name: 'Guardar' }))

    await waitFor(() => {
      expect(rolePayloads).toEqual([{ role: 'admin' }])
    })
    expect(await screen.findByText(hasOwnTextContent('✅ Rol del usuario actualizado correctamente.'))).toBeInTheDocument()

    await userEvent.click(within(carlaRow).getByRole('button', { name: 'Desactivar' }))
    await waitFor(() => {
      expect(deactivatedUsers).toEqual([3])
      expect(confirmSpy).toHaveBeenCalledWith('Desactivar al usuario Carla Customer?')
    })
    expect(await screen.findByText(hasOwnTextContent('✅ Usuario desactivado correctamente.'))).toBeInTheDocument()

    await userEvent.click(within(samRow).getByRole('button', { name: 'Reactivar' }))
    await waitFor(() => {
      expect(reactivatedUsers).toEqual([4])
    })
    expect(await screen.findByText(hasOwnTextContent('✅ Usuario reactivado correctamente.'))).toBeInTheDocument()
  })
})
