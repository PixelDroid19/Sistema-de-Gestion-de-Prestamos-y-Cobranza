import React from 'react'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { delay, http, HttpResponse } from 'msw'
import { vi } from 'vitest'

import i18n from '@/i18n'
import { API_BASE_URL } from '@/lib/api/client'
import * as downloadModule from '@/lib/api/download'
import Loans from '@/pages/Loans/Loans'
import { useDagWorkbenchStore } from '@/store/dagWorkbenchStore'
import { useUiStore } from '@/store/uiStore'
import { renderWithProviders } from '@tests/test/renderWithProviders'
import { server } from '@tests/test/msw/server'

const customerUser = { id: 7, role: 'customer', name: 'Ana Customer' }
const adminUser = { id: 1, role: 'admin', name: 'Ada Admin' }
const adminLoan = {
  id: 101,
  customerId: 12,
  amount: 15000,
  interestRate: 2.1,
  termMonths: 12,
  status: 'approved',
  recoveryStatus: 'in_progress',
  Customer: { id: 12, name: 'Acme Corp' },
  Agent: { id: 4, name: 'Miles Agent' },
  financialSnapshot: {
    installmentAmount: 1400,
    outstandingBalance: 5200,
    totalPayable: 16800,
    outstandingInstallments: 4,
  },
}

describe('Loans page', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('es')
    vi.restoreAllMocks()
    useDagWorkbenchStore.getState().resetWorkbenchDraft({ preserveMode: false })
  })

  it('mounts the real customer workspace and resolves loading into empty loan states', async () => {
    let customerLoanRequests = 0

    server.use(
      http.get(`${API_BASE_URL}/api/loans/customer/${customerUser.id}`, async () => {
        customerLoanRequests += 1
        await delay(80)
        return HttpResponse.json({ data: { loans: [] } })
      }),
    )

    renderWithProviders(<Loans user={customerUser} />)

    expect(screen.getByText('Espacio de prestamos')).toBeInTheDocument()
    expect(await screen.findByText('Cargando prestamos')).toBeInTheDocument()
    expect(await screen.findByText('Crear una nueva solicitud')).toBeInTheDocument()
    expect(await screen.findByText('Aun no tienes prestamos')).toBeInTheDocument()
    expect(customerLoanRequests).toBe(1)
    expect(screen.queryByRole('button', { name: 'Workbench DAG' })).not.toBeInTheDocument()
  })

  it('renders portfolio and servicing sections from live workspace queries', async () => {
    const downloadSpy = vi.spyOn(downloadModule, 'downloadFile').mockResolvedValue(new Blob(['report']))
    const requests = {
      payments: 0,
      alerts: 0,
      promises: 0,
      attachments: 0,
      customerDocuments: 0,
      customerHistory: 0,
    }

    server.use(
      http.get(`${API_BASE_URL}/api/loans`, () => HttpResponse.json({ data: { loans: [adminLoan] } })),
      http.get(`${API_BASE_URL}/api/loans/recovery-roster`, () => HttpResponse.json({ data: { recoveryRoster: [] } })),
      http.get(`${API_BASE_URL}/api/payments/loan/${adminLoan.id}`, () => {
        requests.payments += 1
        return HttpResponse.json({
          data: [{ id: 9001, loanId: adminLoan.id, amount: 1400 }],
        })
      }),
      http.get(`${API_BASE_URL}/api/loans/${adminLoan.id}/alerts`, () => {
        requests.alerts += 1
        return HttpResponse.json({
          data: { alerts: [{ id: 77, installmentNumber: 6, dueDate: '2026-03-10', outstandingAmount: 1400, status: 'active' }] },
        })
      }),
      http.get(`${API_BASE_URL}/api/loans/${adminLoan.id}/promises`, () => {
        requests.promises += 1
        return HttpResponse.json({
          data: { promises: [{ id: 55, promisedDate: '2026-03-25', amount: 1400, status: 'pending', notes: 'Call scheduled' }] },
        })
      }),
      http.get(`${API_BASE_URL}/api/loans/${adminLoan.id}/attachments`, () => {
        requests.attachments += 1
        return HttpResponse.json({
          data: { attachments: [{ id: 44, originalName: 'loan-note.pdf', category: 'note', customerVisible: false }] },
        })
      }),
      http.get(`${API_BASE_URL}/api/customers/${adminLoan.customerId}/documents`, () => {
        requests.customerDocuments += 1
        return HttpResponse.json({
          data: { documents: [{ id: 33, originalName: 'kyc.pdf', category: 'kyc', customerVisible: true }] },
        })
      }),
      http.get(`${API_BASE_URL}/api/reports/customer-history/${adminLoan.customerId}`, () => {
        requests.customerHistory += 1
        return HttpResponse.json({
          data: {
            segments: {
              loans: [{ id: adminLoan.id }],
              payments: [{ id: 9001 }],
              documents: [{ id: 33 }],
              notifications: [{ id: 5 }],
            },
            timeline: [{ id: 'evt-1', eventType: 'loan_created', entityType: 'loan', occurredAt: '2026-03-01T00:00:00.000Z' }],
          },
        })
      }),
    )

    renderWithProviders(<Loans user={adminUser} />)

    expect(await screen.findByText('Resumen operativo de prestamos')).toBeInTheDocument()
    expect(await screen.findByText('Promesas, adjuntos, documentos del cliente e historial')).toBeInTheDocument()
    expect(await screen.findByText('Acme Corp')).toBeInTheDocument()
    expect(screen.getByText('Responsable de recuperacion')).toBeInTheDocument()
    expect(screen.getByText('Alertas: 1')).toBeInTheDocument()
    expect(screen.getByText('Docs cliente: 1')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'PDF del prestamo' }))
    await userEvent.click(screen.getByRole('button', { name: 'PDF del cliente' }))
    expect(downloadSpy).toHaveBeenNthCalledWith(1, expect.objectContaining({ filename: 'loan-101-credit-history.pdf' }))
    expect(downloadSpy).toHaveBeenNthCalledWith(2, expect.objectContaining({ filename: 'customer-12-history.pdf' }))
    expect(requests).toEqual({
      payments: 1,
      alerts: 1,
      promises: 1,
      attachments: 1,
      customerDocuments: 1,
      customerHistory: 1,
    })
  })

  it('routes linked credits back into the editable customer profile without duplicate navigation', async () => {
    useUiStore.setState({
      currentView: 'credits',
      setCurrentView: (nextView) => useUiStore.setState({ currentView: nextView }),
      setCustomerEditId: (customerId) => useUiStore.setState({ customerEditId: Number(customerId) }),
      customerEditId: null,
    })

    server.use(
      http.get(`${API_BASE_URL}/api/loans`, () => HttpResponse.json({ data: { loans: [adminLoan] } })),
      http.get(`${API_BASE_URL}/api/loans/recovery-roster`, () => HttpResponse.json({ data: { recoveryRoster: [] } })),
      http.get(`${API_BASE_URL}/api/payments/loan/${adminLoan.id}`, () => HttpResponse.json({ data: [] })),
      http.get(`${API_BASE_URL}/api/loans/${adminLoan.id}/alerts`, () => HttpResponse.json({ data: { alerts: [] } })),
      http.get(`${API_BASE_URL}/api/loans/${adminLoan.id}/promises`, () => HttpResponse.json({ data: { promises: [] } })),
      http.get(`${API_BASE_URL}/api/loans/${adminLoan.id}/attachments`, () => HttpResponse.json({ data: { attachments: [] } })),
      http.get(`${API_BASE_URL}/api/customers/${adminLoan.customerId}/documents`, () => HttpResponse.json({ data: { documents: [] } })),
      http.get(`${API_BASE_URL}/api/reports/customer-history/${adminLoan.customerId}`, () => HttpResponse.json({ data: { segments: {}, timeline: [] } })),
    )

    renderWithProviders(<Loans user={adminUser} />)

    expect(await screen.findByText('Acme Corp')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Ver cliente' }))

    await waitFor(() => {
      expect(useUiStore.getState().currentView).toBe('customers')
      expect(useUiStore.getState().customerEditId).toBe(12)
    })
  })

  it('uses aligned payment-history collections when loan payment queries return payments plus loan context', async () => {
    const progressLoan = {
      ...adminLoan,
      id: 151,
      termMonths: 12,
      financialSnapshot: {
        installmentAmount: 1400,
        outstandingBalance: 5200,
        totalPayable: 16800,
      },
    }

    server.use(
      http.get(`${API_BASE_URL}/api/loans`, () => HttpResponse.json({ data: { loans: [progressLoan] } })),
      http.get(`${API_BASE_URL}/api/loans/recovery-roster`, () => HttpResponse.json({ data: { recoveryRoster: [] } })),
      http.get(`${API_BASE_URL}/api/payments/loan/${progressLoan.id}`, () => HttpResponse.json({
        data: {
          payments: [{ id: 9901, loanId: progressLoan.id, amount: 1400 }],
          loan: {
            ...progressLoan,
            customerSummary: {
              totalLoans: 2,
              activeLoans: 1,
              totalOutstandingBalance: 5200,
              latestLoanId: progressLoan.id,
              latestLoanStatus: 'approved',
            },
          },
        },
      })),
      http.get(`${API_BASE_URL}/api/loans/${progressLoan.id}/alerts`, () => HttpResponse.json({ data: { alerts: [] } })),
      http.get(`${API_BASE_URL}/api/loans/${progressLoan.id}/promises`, () => HttpResponse.json({ data: { promises: [] } })),
      http.get(`${API_BASE_URL}/api/loans/${progressLoan.id}/attachments`, () => HttpResponse.json({ data: { attachments: [] } })),
      http.get(`${API_BASE_URL}/api/customers/${progressLoan.customerId}/documents`, () => HttpResponse.json({ data: { documents: [] } })),
      http.get(`${API_BASE_URL}/api/reports/customer-history/${progressLoan.customerId}`, () => HttpResponse.json({ data: { segments: {}, timeline: [] } })),
    )

    renderWithProviders(<Loans user={adminUser} />)

    expect(await screen.findByText('Acme Corp')).toBeInTheDocument()
    expect(screen.getByText('1/12')).toBeInTheDocument()
  })

  it('submits the expected status payload when approving a pending loan', async () => {
    const pendingLoan = {
      ...adminLoan,
      id: 202,
      status: 'pending',
      recoveryStatus: 'pending',
    }
    const updateStatusSpy = vi.fn()

    server.use(
      http.get(`${API_BASE_URL}/api/loans`, () => HttpResponse.json({ data: { loans: [pendingLoan] } })),
      http.patch(`${API_BASE_URL}/api/loans/${pendingLoan.id}/status`, async ({ request }) => {
        updateStatusSpy(await request.json())
        return HttpResponse.json({ data: { id: pendingLoan.id, status: 'approved' } })
      }),
      http.get(`${API_BASE_URL}/api/payments/loan/${pendingLoan.id}`, () => HttpResponse.json({ data: [] })),
      http.get(`${API_BASE_URL}/api/loans/${pendingLoan.id}/alerts`, () => HttpResponse.json({ data: { alerts: [] } })),
      http.get(`${API_BASE_URL}/api/loans/${pendingLoan.id}/promises`, () => HttpResponse.json({ data: { promises: [] } })),
      http.get(`${API_BASE_URL}/api/loans/${pendingLoan.id}/attachments`, () => HttpResponse.json({ data: { attachments: [] } })),
      http.get(`${API_BASE_URL}/api/customers/${pendingLoan.customerId}/documents`, () => HttpResponse.json({ data: { documents: [] } })),
      http.get(`${API_BASE_URL}/api/reports/customer-history/${pendingLoan.customerId}`, () => HttpResponse.json({ data: { segments: {}, timeline: [] } })),
    )

    renderWithProviders(<Loans user={adminUser} />)

    await screen.findByText('Acme Corp')
    await userEvent.click(screen.getByRole('button', { name: 'Aprobar' }))

    await waitFor(() => {
      expect(updateStatusSpy).toHaveBeenCalledWith({ status: 'approved' })
    })
  })

  it('creates servicing follow-ups and updates promise status from the live workspace', async () => {
    const followUpPayloads = []
    const promiseStatusPayloads = []

    server.use(
      http.get(`${API_BASE_URL}/api/loans`, () => HttpResponse.json({ data: { loans: [adminLoan] } })),
      http.get(`${API_BASE_URL}/api/payments/loan/${adminLoan.id}`, () => HttpResponse.json({
        data: [{ id: 9001, loanId: adminLoan.id, amount: 1400 }],
      })),
      http.get(`${API_BASE_URL}/api/loans/${adminLoan.id}/alerts`, () => HttpResponse.json({
        data: { alerts: [{ id: 77, installmentNumber: 6, dueDate: '2026-03-10', outstandingAmount: 1400, status: 'active' }] },
      })),
      http.get(`${API_BASE_URL}/api/loans/${adminLoan.id}/promises`, () => HttpResponse.json({
        data: { promises: [{ id: 55, promisedDate: '2026-03-25', amount: 1400, status: 'pending', notes: 'Call scheduled' }] },
      })),
      http.get(`${API_BASE_URL}/api/loans/${adminLoan.id}/attachments`, () => HttpResponse.json({ data: { attachments: [] } })),
      http.get(`${API_BASE_URL}/api/customers/${adminLoan.customerId}/documents`, () => HttpResponse.json({ data: { documents: [] } })),
      http.get(`${API_BASE_URL}/api/reports/customer-history/${adminLoan.customerId}`, () => HttpResponse.json({ data: { segments: {}, timeline: [] } })),
      http.post(`${API_BASE_URL}/api/loans/${adminLoan.id}/follow-ups`, async ({ request }) => {
        followUpPayloads.push(await request.json())
        return HttpResponse.json({ data: { reminder: { id: 91 } } }, { status: 201 })
      }),
      http.patch(`${API_BASE_URL}/api/loans/${adminLoan.id}/promises/55/status`, async ({ request }) => {
        promiseStatusPayloads.push(await request.json())
        return HttpResponse.json({ data: { promise: { id: 55, status: 'kept' } } })
      }),
    )

    renderWithProviders(<Loans user={adminUser} />)

    expect(await screen.findByText('Promesas, adjuntos, documentos del cliente e historial')).toBeInTheDocument()

    const servicingSection = screen.getByText('Promesas, adjuntos, documentos del cliente e historial').closest('section')
    const servicingQueries = within(servicingSection)

    await userEvent.type(servicingQueries.getByLabelText('Numero de cuota'), '6')
    await userEvent.type(servicingQueries.getByLabelText('Fecha de vencimiento'), '2026-03-30')
    await userEvent.type(servicingQueries.getByLabelText('Monto pendiente'), '1400')
    await userEvent.type(servicingQueries.getAllByLabelText('Notas')[1], 'Seguimiento programado para hoy')
    await userEvent.click(servicingQueries.getByRole('button', { name: 'Crear seguimiento' }))

    await waitFor(() => {
      expect(screen.getByText(/Seguimiento creado correctamente\./)).toBeInTheDocument()
    })
    expect(followUpPayloads).toEqual([
      {
        installmentNumber: '6',
        dueDate: '2026-03-30',
        outstandingAmount: '1400',
        notes: 'Seguimiento programado para hoy',
        notifyCustomer: true,
      },
    ])

    await userEvent.click(servicingQueries.getByRole('button', { name: 'Marcar cumplida' }))

    await waitFor(() => {
      expect(screen.getByText(/Promesa actualizada correctamente\./)).toBeInTheDocument()
    })
    expect(promiseStatusPayloads).toEqual([
      {
        status: 'kept',
        notes: 'Promise marked kept',
      },
    ])
  })

  it('lets admins edit recovery on defaulted loans and submits expanded recovery statuses', async () => {
    const recoveryLoan = {
      ...adminLoan,
      id: 303,
      status: 'defaulted',
      recoveryStatus: 'assigned',
    }
    const updateRecoveryPayloads = []

    server.use(
      http.get(`${API_BASE_URL}/api/loans`, () => HttpResponse.json({ data: { loans: [recoveryLoan] } })),
      http.get(`${API_BASE_URL}/api/loans/recovery-roster`, () => HttpResponse.json({ data: { recoveryRoster: [] } })),
      http.get(`${API_BASE_URL}/api/payments/loan/${recoveryLoan.id}`, () => HttpResponse.json({ data: [] })),
      http.get(`${API_BASE_URL}/api/loans/${recoveryLoan.id}/alerts`, () => HttpResponse.json({ data: { alerts: [] } })),
      http.get(`${API_BASE_URL}/api/loans/${recoveryLoan.id}/promises`, () => HttpResponse.json({ data: { promises: [] } })),
      http.get(`${API_BASE_URL}/api/loans/${recoveryLoan.id}/attachments`, () => HttpResponse.json({ data: { attachments: [] } })),
      http.get(`${API_BASE_URL}/api/customers/${recoveryLoan.customerId}/documents`, () => HttpResponse.json({ data: { documents: [] } })),
      http.get(`${API_BASE_URL}/api/reports/customer-history/${recoveryLoan.customerId}`, () => HttpResponse.json({ data: { segments: {}, timeline: [] } })),
      http.patch(`${API_BASE_URL}/api/loans/${recoveryLoan.id}/recovery-status`, async ({ request }) => {
        updateRecoveryPayloads.push(await request.json())
        return HttpResponse.json({
          data: {
            loan: {
              ...recoveryLoan,
              recoveryStatus: 'contacted',
            },
          },
        })
      }),
    )

    renderWithProviders(<Loans user={adminUser} />)

    await screen.findByText('Acme Corp')
    await userEvent.click(screen.getByRole('button', { name: 'Editar recuperacion' }))

    const statusSelect = screen.getByRole('combobox')
    expect(within(statusSelect).getByRole('option', { name: 'Contacted' })).toBeInTheDocument()
    await userEvent.selectOptions(statusSelect, 'contacted')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar estado' }))

    await waitFor(() => {
      expect(updateRecoveryPayloads).toEqual([{ recoveryStatus: 'contacted' }])
    })
    expect(await screen.findByText(/Estado de recuperacion actualizado correctamente\./)).toBeInTheDocument()
  })

  it('keeps legacy agent assignment history visible while admins remain the recovery operator', async () => {
    const recoveryLoan = {
      ...adminLoan,
      id: 304,
      status: 'defaulted',
      recoveryStatus: 'assigned',
      agentId: undefined,
      Agent: { id: 4, name: 'Miles Agent' },
    }

    server.use(
      http.get(`${API_BASE_URL}/api/loans`, () => HttpResponse.json({ data: { loans: [recoveryLoan] } })),
      http.get(`${API_BASE_URL}/api/payments/loan/${recoveryLoan.id}`, () => HttpResponse.json({ data: [] })),
      http.get(`${API_BASE_URL}/api/loans/${recoveryLoan.id}/alerts`, () => HttpResponse.json({ data: { alerts: [] } })),
      http.get(`${API_BASE_URL}/api/loans/${recoveryLoan.id}/promises`, () => HttpResponse.json({ data: { promises: [] } })),
      http.get(`${API_BASE_URL}/api/loans/${recoveryLoan.id}/attachments`, () => HttpResponse.json({ data: { attachments: [] } })),
      http.get(`${API_BASE_URL}/api/customers/${recoveryLoan.customerId}/documents`, () => HttpResponse.json({ data: { documents: [] } })),
      http.get(`${API_BASE_URL}/api/reports/customer-history/${recoveryLoan.customerId}`, () => HttpResponse.json({ data: { segments: {}, timeline: [] } })),
    )

    renderWithProviders(<Loans user={adminUser} />)

    await screen.findByText('Acme Corp')
    expect(screen.getByText('Responsable de recuperacion')).toBeInTheDocument()
    expect(screen.getByText('Miles Agent')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Editar recuperacion' })).toBeInTheDocument()
  })

  it('creates promises to pay and refreshes servicing counters from mutation responses', async () => {
    const promiseLoan = {
      ...adminLoan,
      id: 404,
      status: 'defaulted',
      recoveryStatus: 'in_progress',
    }
    const createPromisePayloads = []
    let promiseListRequests = 0

    server.use(
      http.get(`${API_BASE_URL}/api/loans`, () => HttpResponse.json({ data: { loans: [promiseLoan] } })),
      http.get(`${API_BASE_URL}/api/payments/loan/${promiseLoan.id}`, () => HttpResponse.json({ data: [] })),
      http.get(`${API_BASE_URL}/api/loans/${promiseLoan.id}/alerts`, () => HttpResponse.json({ data: { alerts: [] } })),
      http.get(`${API_BASE_URL}/api/loans/${promiseLoan.id}/promises`, async () => {
        promiseListRequests += 1
        if (promiseListRequests === 1) {
          return HttpResponse.json({ data: { promises: [] } })
        }

        return HttpResponse.json({ data: { promises: [{ id: 81, promisedDate: '2026-04-05', amount: 550, status: 'pending', notes: 'Payroll date' }] } })
      }),
      http.get(`${API_BASE_URL}/api/loans/${promiseLoan.id}/attachments`, () => HttpResponse.json({ data: { attachments: [] } })),
      http.get(`${API_BASE_URL}/api/customers/${promiseLoan.customerId}/documents`, () => HttpResponse.json({ data: { documents: [] } })),
      http.get(`${API_BASE_URL}/api/reports/customer-history/${promiseLoan.customerId}`, () => HttpResponse.json({ data: { segments: {}, timeline: [] } })),
      http.post(`${API_BASE_URL}/api/loans/${promiseLoan.id}/promises`, async ({ request }) => {
        createPromisePayloads.push(await request.json())
        return HttpResponse.json({
          data: {
            promise: {
              id: 81,
              promisedDate: '2026-04-05',
              amount: 550,
              status: 'pending',
              notes: 'Payroll date',
            },
          },
        }, { status: 201 })
      }),
    )

    renderWithProviders(<Loans user={adminUser} />)

    expect(await screen.findByText('Promesas, adjuntos, documentos del cliente e historial')).toBeInTheDocument()

    const servicingSection = screen.getByText('Promesas, adjuntos, documentos del cliente e historial').closest('section')
    const servicingQueries = within(servicingSection)

    await userEvent.type(servicingQueries.getByLabelText('Fecha prometida'), '2026-04-05')
    await userEvent.type(servicingQueries.getByLabelText('Monto prometido'), '550')
    await userEvent.type(servicingQueries.getAllByLabelText('Notas')[0], 'Payroll date')
    await userEvent.click(servicingQueries.getByRole('button', { name: 'Guardar promesa' }))

    await waitFor(() => {
      expect(createPromisePayloads).toEqual([
        {
          promisedDate: '2026-04-05',
          amount: '550',
          notes: 'Payroll date',
        },
      ])
    })
    expect(await screen.findByText(/Promesa de pago creada correctamente\./)).toBeInTheDocument()
    expect(screen.getByText('Promesas')).toBeInTheDocument()
    expect(await screen.findByText('81')).toBeInTheDocument()
    expect((await screen.findAllByText('4 Apr 2026')).length).toBeGreaterThan(0)
  })

  it('binds promise inputs and submit actions to the correct servicing card when multiple loans are rendered', async () => {
    const firstLoan = {
      ...adminLoan,
      id: 16,
      customerId: 116,
      Customer: { id: 116, name: 'First Customer' },
      status: 'defaulted',
    }
    const secondLoan = {
      ...adminLoan,
      id: 17,
      customerId: 117,
      Customer: { id: 117, name: 'Second Customer' },
      status: 'defaulted',
    }
    const createPromisePayloads = []

    server.use(
      http.get(`${API_BASE_URL}/api/loans`, () => HttpResponse.json({ data: { loans: [firstLoan, secondLoan] } })),
      http.get(`${API_BASE_URL}/api/payments/loan/${firstLoan.id}`, () => HttpResponse.json({ data: [] })),
      http.get(`${API_BASE_URL}/api/payments/loan/${secondLoan.id}`, () => HttpResponse.json({ data: [] })),
      http.get(`${API_BASE_URL}/api/loans/${firstLoan.id}/alerts`, () => HttpResponse.json({ data: { alerts: [] } })),
      http.get(`${API_BASE_URL}/api/loans/${secondLoan.id}/alerts`, () => HttpResponse.json({ data: { alerts: [] } })),
      http.get(`${API_BASE_URL}/api/loans/${firstLoan.id}/promises`, () => HttpResponse.json({ data: { promises: [] } })),
      http.get(`${API_BASE_URL}/api/loans/${secondLoan.id}/promises`, () => HttpResponse.json({ data: { promises: [] } })),
      http.get(`${API_BASE_URL}/api/loans/${firstLoan.id}/attachments`, () => HttpResponse.json({ data: { attachments: [] } })),
      http.get(`${API_BASE_URL}/api/loans/${secondLoan.id}/attachments`, () => HttpResponse.json({ data: { attachments: [] } })),
      http.get(`${API_BASE_URL}/api/customers/${firstLoan.customerId}/documents`, () => HttpResponse.json({ data: { documents: [] } })),
      http.get(`${API_BASE_URL}/api/customers/${secondLoan.customerId}/documents`, () => HttpResponse.json({ data: { documents: [] } })),
      http.get(`${API_BASE_URL}/api/reports/customer-history/${firstLoan.customerId}`, () => HttpResponse.json({ data: { segments: {}, timeline: [] } })),
      http.get(`${API_BASE_URL}/api/reports/customer-history/${secondLoan.customerId}`, () => HttpResponse.json({ data: { segments: {}, timeline: [] } })),
      http.post(`${API_BASE_URL}/api/loans/${secondLoan.id}/promises`, async ({ request }) => {
        createPromisePayloads.push({ loanId: secondLoan.id, payload: await request.json() })
        return HttpResponse.json({
          data: {
            promise: {
              id: 91,
              promisedDate: '2026-04-08',
              amount: 725,
              status: 'pending',
              notes: 'Second card promise',
            },
          },
        }, { status: 201 })
      }),
    )

    renderWithProviders(<Loans user={adminUser} />)

    expect(await screen.findByText('Second Customer')).toBeInTheDocument()

    const secondCard = screen.getByText('Loan #17').closest('[data-loan-id="17"]')
    const secondCardQueries = within(secondCard)

    await userEvent.type(secondCardQueries.getByTestId('loan-17-promise-promised-date'), '2026-04-08')
    await userEvent.type(secondCardQueries.getByTestId('loan-17-promise-amount'), '725')
    await userEvent.type(secondCardQueries.getByTestId('loan-17-promise-notes'), 'Second card promise')
    await userEvent.click(secondCardQueries.getByTestId('loan-17-create-promise'))

    await waitFor(() => {
      expect(createPromisePayloads).toEqual([
        {
          loanId: 17,
          payload: {
            promisedDate: '2026-04-08',
            amount: '725',
            notes: 'Second card promise',
          },
        },
      ])
    })
  })

  it('binds follow-up inputs and submit actions to the correct servicing card when multiple loans are rendered', async () => {
    const firstLoan = {
      ...adminLoan,
      id: 26,
      customerId: 126,
      Customer: { id: 126, name: 'First Follow Up Customer' },
      status: 'defaulted',
    }
    const secondLoan = {
      ...adminLoan,
      id: 27,
      customerId: 127,
      Customer: { id: 127, name: 'Second Follow Up Customer' },
      status: 'defaulted',
    }
    const followUpPayloads = []

    server.use(
      http.get(`${API_BASE_URL}/api/loans`, () => HttpResponse.json({ data: { loans: [firstLoan, secondLoan] } })),
      http.get(`${API_BASE_URL}/api/payments/loan/${firstLoan.id}`, () => HttpResponse.json({ data: [] })),
      http.get(`${API_BASE_URL}/api/payments/loan/${secondLoan.id}`, () => HttpResponse.json({ data: [] })),
      http.get(`${API_BASE_URL}/api/loans/${firstLoan.id}/alerts`, () => HttpResponse.json({ data: { alerts: [] } })),
      http.get(`${API_BASE_URL}/api/loans/${secondLoan.id}/alerts`, () => HttpResponse.json({ data: { alerts: [] } })),
      http.get(`${API_BASE_URL}/api/loans/${firstLoan.id}/promises`, () => HttpResponse.json({ data: { promises: [] } })),
      http.get(`${API_BASE_URL}/api/loans/${secondLoan.id}/promises`, () => HttpResponse.json({ data: { promises: [] } })),
      http.get(`${API_BASE_URL}/api/loans/${firstLoan.id}/attachments`, () => HttpResponse.json({ data: { attachments: [] } })),
      http.get(`${API_BASE_URL}/api/loans/${secondLoan.id}/attachments`, () => HttpResponse.json({ data: { attachments: [] } })),
      http.get(`${API_BASE_URL}/api/customers/${firstLoan.customerId}/documents`, () => HttpResponse.json({ data: { documents: [] } })),
      http.get(`${API_BASE_URL}/api/customers/${secondLoan.customerId}/documents`, () => HttpResponse.json({ data: { documents: [] } })),
      http.get(`${API_BASE_URL}/api/reports/customer-history/${firstLoan.customerId}`, () => HttpResponse.json({ data: { segments: {}, timeline: [] } })),
      http.get(`${API_BASE_URL}/api/reports/customer-history/${secondLoan.customerId}`, () => HttpResponse.json({ data: { segments: {}, timeline: [] } })),
      http.post(`${API_BASE_URL}/api/loans/${secondLoan.id}/follow-ups`, async ({ request }) => {
        followUpPayloads.push({ loanId: secondLoan.id, payload: await request.json() })
        return HttpResponse.json({ data: { reminder: { id: 190 } } }, { status: 201 })
      }),
    )

    renderWithProviders(<Loans user={adminUser} />)

    expect(await screen.findByText('Second Follow Up Customer')).toBeInTheDocument()

    const secondCard = screen.getByText('Loan #27').closest('[data-loan-id="27"]')
    const secondCardQueries = within(secondCard)

    await userEvent.type(secondCardQueries.getByTestId('loan-27-follow-up-installment-number'), '6')
    await userEvent.type(secondCardQueries.getByTestId('loan-27-follow-up-due-date'), '2026-04-09')
    await userEvent.type(secondCardQueries.getByTestId('loan-27-follow-up-outstanding-amount'), '410')
    await userEvent.type(secondCardQueries.getByTestId('loan-27-follow-up-notes'), 'Second card follow-up')
    await userEvent.click(secondCardQueries.getByTestId('loan-27-create-follow-up'))

    await waitFor(() => {
      expect(followUpPayloads).toEqual([
        {
          loanId: 27,
          payload: {
            installmentNumber: '6',
            dueDate: '2026-04-09',
            outstandingAmount: '410',
            notes: 'Second card follow-up',
            notifyCustomer: true,
          },
        },
      ])
    })
  })

  it('resolves alerts and refreshes active counters from mutation responses', async () => {
    const alertLoan = {
      ...adminLoan,
      id: 505,
      status: 'defaulted',
      recoveryStatus: 'in_progress',
    }
    const resolveAlertPayloads = []
    let alertListRequests = 0

    server.use(
      http.get(`${API_BASE_URL}/api/loans`, () => HttpResponse.json({ data: { loans: [alertLoan] } })),
      http.get(`${API_BASE_URL}/api/payments/loan/${alertLoan.id}`, () => HttpResponse.json({ data: [] })),
      http.get(`${API_BASE_URL}/api/loans/${alertLoan.id}/alerts`, async () => {
        alertListRequests += 1
        if (alertListRequests === 1) {
          return HttpResponse.json({
            data: {
              alerts: [{ id: 77, installmentNumber: 6, dueDate: '2026-03-10', outstandingAmount: 1400, status: 'active' }],
            },
          })
        }

        return HttpResponse.json({
          data: {
            alerts: [{ id: 77, installmentNumber: 6, dueDate: '2026-03-10', outstandingAmount: 1400, status: 'resolved' }],
          },
        })
      }),
      http.get(`${API_BASE_URL}/api/loans/${alertLoan.id}/promises`, () => HttpResponse.json({ data: { promises: [] } })),
      http.get(`${API_BASE_URL}/api/loans/${alertLoan.id}/attachments`, () => HttpResponse.json({ data: { attachments: [] } })),
      http.get(`${API_BASE_URL}/api/customers/${alertLoan.customerId}/documents`, () => HttpResponse.json({ data: { documents: [] } })),
      http.get(`${API_BASE_URL}/api/reports/customer-history/${alertLoan.customerId}`, () => HttpResponse.json({ data: { segments: {}, timeline: [] } })),
      http.patch(`${API_BASE_URL}/api/loans/${alertLoan.id}/alerts/77/status`, async ({ request }) => {
        resolveAlertPayloads.push(await request.json())
        return HttpResponse.json({
          data: {
            alert: {
              id: 77,
              installmentNumber: 6,
              dueDate: '2026-03-10',
              outstandingAmount: 1400,
              status: 'resolved',
              resolutionSource: 'manual_follow_up',
            },
          },
        })
      }),
    )

    renderWithProviders(<Loans user={adminUser} />)

    expect(await screen.findByText('Promesas, adjuntos, documentos del cliente e historial')).toBeInTheDocument()

    const servicingSection = screen.getByText('Promesas, adjuntos, documentos del cliente e historial').closest('section')
    const servicingQueries = within(servicingSection)

    expect(within(servicingSection).getByText('Alertas')).toBeInTheDocument()
    expect(within(servicingSection).getByText('active')).toBeInTheDocument()
    await userEvent.click(servicingQueries.getByRole('button', { name: 'Resolver alerta' }))

    await waitFor(() => {
      expect(resolveAlertPayloads).toEqual([
        {
          status: 'resolved',
          resolutionSource: 'manual_follow_up',
          notes: 'Resolved from servicing workspace',
        },
      ])
    })
    expect(await screen.findByText(/Alerta marcada como resuelta\./)).toBeInTheDocument()
    await waitFor(() => {
      expect(within(servicingSection).queryByRole('button', { name: 'Resolver alerta' })).not.toBeInTheDocument()
    })
    expect(within(servicingSection).getByText('resolved')).toBeInTheDocument()
  })

  it('switches admins into the DAG workbench and wires validate, save, and simulate calls', async () => {
    const validatePayloads = []
    const savePayloads = []
    const simulatePayloads = []

    server.use(
      http.get(`${API_BASE_URL}/api/loans`, () => HttpResponse.json({ data: { loans: [] } })),
      http.get(`${API_BASE_URL}/api/loans/workbench/graph`, ({ request }) => {
        const scope = new URL(request.url).searchParams.get('scope')
        return HttpResponse.json({
          data: {
            graph: {
              id: 1,
              scopeKey: scope,
              version: 3,
              name: 'Personal Loan DAG',
              graph: {
                nodes: [
                  { id: 'principal', kind: 'input', label: 'Principal', outputVar: 'principal', value: '0', position: { x: 80, y: 90 } },
                  { id: 'result', kind: 'output', label: 'Monthly Payment', outputVar: 'monthly_payment', formula: 'principal * (1 + commission_rate)', position: { x: 360, y: 220 } },
                ],
                edges: [{ id: 'edge-1', source: 'principal', target: 'result' }],
                variables: [{ id: 'variable-commission-rate', key: 'commission_rate', value: '0.12' }],
              },
              graphSummary: { nodeCount: 2, edgeCount: 1 },
              validation: { valid: true, errors: [], warnings: [], summary: { nodeCount: 2, edgeCount: 1 } },
            },
          },
        })
      }),
      http.get(`${API_BASE_URL}/api/loans/workbench/graph/summary`, ({ request }) => {
        const scope = new URL(request.url).searchParams.get('scope')
        return HttpResponse.json({
          data: {
            summary: {
              latestGraph: {
                id: 1,
                scopeKey: scope,
                version: 3,
                name: 'Personal Loan DAG',
                graphSummary: { nodeCount: 2, edgeCount: 1 },
              },
              latestSimulation: {
                id: 2,
                selectedSource: 'dag',
                parity: { passed: true },
                schedulePreview: [{ installment: 1 }],
              },
            },
          },
        })
      }),
      http.post(`${API_BASE_URL}/api/loans/workbench/graph/validate`, async ({ request }) => {
        validatePayloads.push(await request.json())
        return HttpResponse.json({
          data: {
            validation: {
              valid: true,
              errors: [],
              warnings: [{ field: 'nodes', message: 'Graph does not declare any output nodes' }],
              summary: { nodeCount: 2, edgeCount: 1 },
            },
          },
        })
      }),
      http.post(`${API_BASE_URL}/api/loans/workbench/graph`, async ({ request }) => {
        savePayloads.push(await request.json())
        return HttpResponse.json({
          data: {
            graph: {
              graphVersion: {
                id: 3,
                scopeKey: 'personal-loan',
                version: 4,
                name: 'Personal Loan DAG',
              },
              validation: {
                valid: true,
                errors: [],
                warnings: [],
                summary: { nodeCount: 2, edgeCount: 1 },
              },
            },
          },
        }, { status: 201 })
      }),
      http.post(`${API_BASE_URL}/api/loans/workbench/graph/simulations`, async ({ request }) => {
        simulatePayloads.push(await request.json())
        return HttpResponse.json({
          data: {
            validation: {
              valid: true,
              errors: [],
              warnings: [],
              summary: { nodeCount: 2, edgeCount: 1 },
            },
            simulation: {
              summary: { totalPayable: 1120, monthlyInstallment: 93.33 },
              schedule: [{ installment: 1 }, { installment: 2 }],
            },
            summary: {
              latestGraph: {
                id: 3,
                scopeKey: 'personal-loan',
                version: 4,
                name: 'Personal Loan DAG',
                graphSummary: { nodeCount: 2, edgeCount: 1 },
              },
              latestSimulation: {
                id: 4,
                selectedSource: 'dag',
                parity: { passed: true },
                schedulePreview: [{ installment: 1 }, { installment: 2 }],
              },
            },
          },
        })
      }),
    )

    renderWithProviders(<Loans user={adminUser} />)

    await screen.findByText('Resumen operativo de prestamos')
    await userEvent.click(screen.getByRole('button', { name: 'Workbench DAG' }))

    expect(await screen.findByText('Workbench DAG conectado al backend')).toBeInTheDocument()
    expect(await screen.findByDisplayValue('Personal Loan DAG')).toBeInTheDocument()
    expect(screen.getByText('FinEngine DAG')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add node' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Canvas' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Table' })).toBeInTheDocument()
    expect(screen.getAllByText('Principal').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Monthly Payment').length).toBeGreaterThan(0)
    expect(screen.getByDisplayValue('commission_rate')).toBeInTheDocument()
    expect(screen.getByText('Topology ready')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Validar' }))
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await userEvent.click(screen.getByRole('button', { name: 'Simular' }))

    await waitFor(() => {
      expect(validatePayloads).toHaveLength(1)
      expect(savePayloads).toHaveLength(1)
      expect(simulatePayloads).toHaveLength(1)
    })

    expect(validatePayloads[0]).toEqual({
      scopeKey: 'personal-loan',
      graph: {
        nodes: [
          {
            id: 'principal',
            kind: 'input',
            label: 'Principal',
            formula: '',
            outputVar: 'principal',
            value: '0',
            position: { x: 80, y: 90 },
          },
          {
            id: 'result',
            kind: 'output',
            label: 'Monthly Payment',
            formula: 'principal * (1 + commission_rate)',
            outputVar: 'monthly_payment',
            value: '',
            position: { x: 360, y: 220 },
          },
        ],
        edges: [{ id: 'edge-1', source: 'principal', target: 'result' }],
        variables: [{ id: 'variable-commission-rate', key: 'commission_rate', value: '0.12' }],
      },
    })
    expect(savePayloads[0]).toEqual({
      scopeKey: 'personal-loan',
      name: 'Personal Loan DAG',
      graph: validatePayloads[0].graph,
    })
    expect(simulatePayloads[0]).toEqual({
      scopeKey: 'personal-loan',
      graph: validatePayloads[0].graph,
      simulationInput: {
        amount: 1000,
        interestRate: 12,
        termMonths: 12,
      },
    })

    expect(await screen.findByText('Total a pagar: 1120')).toBeInTheDocument()
    expect(screen.getByText('Cuotas simuladas: 2')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Table' }))
    expect(await screen.findByText('Output variables')).toBeInTheDocument()
    expect(screen.getAllByText('monthly_payment').length).toBeGreaterThan(0)
  })

  it('lets users edit node formulas and dependency links from the inspector', async () => {
    server.use(
      http.get(`${API_BASE_URL}/api/loans`, () => HttpResponse.json({ data: { loans: [] } })),
      http.get(`${API_BASE_URL}/api/loans/workbench/graph`, ({ request }) => {
        const scope = new URL(request.url).searchParams.get('scope')
        return HttpResponse.json({
          data: {
            graph: {
              id: 1,
              scopeKey: scope,
              version: 3,
              name: 'Personal Loan DAG',
              graph: {
                nodes: [
                  { id: 'principal', kind: 'input', label: 'Principal', outputVar: 'principal', value: '0', position: { x: 80, y: 90 } },
                  { id: 'result', kind: 'output', label: 'Monthly Payment', outputVar: 'monthly_payment', formula: 'principal', position: { x: 360, y: 220 } },
                ],
                edges: [{ id: 'edge-1', source: 'principal', target: 'result' }],
                variables: [{ id: 'variable-commission-rate', key: 'commission_rate', value: '0.12' }],
              },
              graphSummary: { nodeCount: 2, edgeCount: 1 },
              validation: { valid: true, errors: [], warnings: [], summary: { nodeCount: 2, edgeCount: 1 } },
            },
          },
        })
      }),
      http.get(`${API_BASE_URL}/api/loans/workbench/graph/summary`, () => HttpResponse.json({
        data: {
          summary: {
            latestGraph: { id: 1, scopeKey: 'personal-loan', version: 3, name: 'Personal Loan DAG', graphSummary: { nodeCount: 2, edgeCount: 1 } },
            latestSimulation: null,
          },
        },
      })),
    )

    renderWithProviders(<Loans user={adminUser} />)

    await screen.findByText('Resumen operativo de prestamos')
    await userEvent.click(screen.getByRole('button', { name: 'Workbench DAG' }))

    expect((await screen.findAllByText('Monthly Payment')).length).toBeGreaterThan(0)
    await userEvent.click(screen.getAllByText('Monthly Payment')[0])

    const formulaArea = screen.getByLabelText('Formula')
    await userEvent.clear(formulaArea)
    await userEvent.type(formulaArea, 'principal')
    await userEvent.click(screen.getByRole('button', { name: 'commission_rate' }))

    await waitFor(() => {
      expect(useDagWorkbenchStore.getState().graph.nodes[1].formula).toContain('commission_rate')
    })

    await userEvent.type(screen.getByLabelText('Source node'), 'principal')
    await userEvent.clear(screen.getByLabelText('Target node'))
    await userEvent.type(screen.getByLabelText('Target node'), 'result')
    await userEvent.click(screen.getByRole('button', { name: 'Disconnect' }))

    await waitFor(() => {
      expect(useDagWorkbenchStore.getState().graph.edges).toEqual([])
    })
  })

  it('shows legacy fallback readiness metadata after a parity mismatch simulation', async () => {
    server.use(
      http.get(`${API_BASE_URL}/api/loans`, () => HttpResponse.json({ data: { loans: [] } })),
      http.get(`${API_BASE_URL}/api/loans/workbench/graph`, ({ request }) => {
        const scope = new URL(request.url).searchParams.get('scope')
        return HttpResponse.json({
          data: {
            graph: {
              id: 1,
              scopeKey: scope,
              version: 3,
              name: 'Personal Loan DAG',
              graph: {
                nodes: [
                  { id: 'principal', kind: 'input', label: 'Principal', outputVar: 'principal', value: '0', position: { x: 80, y: 90 } },
                  { id: 'result', kind: 'output', label: 'Monthly Payment', outputVar: 'monthly_payment', formula: 'principal * 1.2', position: { x: 360, y: 220 } },
                ],
                edges: [{ id: 'edge-1', source: 'principal', target: 'result' }],
                variables: [],
              },
              graphSummary: { nodeCount: 2, edgeCount: 1 },
              validation: { valid: true, errors: [], warnings: [], summary: { nodeCount: 2, edgeCount: 1 } },
            },
          },
        })
      }),
      http.get(`${API_BASE_URL}/api/loans/workbench/graph/summary`, () => HttpResponse.json({
        data: {
          summary: {
            latestGraph: {
              id: 1,
              scopeKey: 'personal-loan',
              version: 3,
              name: 'Personal Loan DAG',
              graphSummary: { nodeCount: 2, edgeCount: 1 },
            },
            latestSimulation: null,
          },
        },
      })),
      http.post(`${API_BASE_URL}/api/loans/workbench/graph/simulations`, () => HttpResponse.json({
        data: {
          validation: {
            valid: true,
            errors: [],
            warnings: [],
            summary: { nodeCount: 2, edgeCount: 1 },
          },
          simulation: {
            summary: { totalPayable: 1120, monthlyInstallment: 93.33 },
            schedule: [{ installment: 1 }, { installment: 2 }],
          },
          summary: {
            latestGraph: {
              id: 3,
              scopeKey: 'personal-loan',
              version: 4,
              name: 'Personal Loan DAG',
              graphSummary: { nodeCount: 2, edgeCount: 1 },
            },
            latestSimulation: {
              id: 4,
              selectedSource: 'legacy',
              fallbackReason: 'parity_mismatch',
              parity: { passed: false },
              schedulePreview: [{ installment: 1 }, { installment: 2 }],
            },
          },
        },
      })),
    )

    renderWithProviders(<Loans user={adminUser} />)

    await screen.findByText('Resumen operativo de prestamos')
    await userEvent.click(screen.getByRole('button', { name: 'Workbench DAG' }))
    await screen.findByText('Workbench DAG conectado al backend')

    await userEvent.click(screen.getByRole('button', { name: 'Simular' }))

    expect(await screen.findByText('legacy / Paridad con diferencias')).toBeInTheDocument()
    expect(screen.getByText('Fallback: parity_mismatch')).toBeInTheDocument()
  })

  it('shows rollout access errors when the backend rejects the DAG workbench scope', async () => {
    server.use(
      http.get(`${API_BASE_URL}/api/loans`, () => HttpResponse.json({ data: { loans: [] } })),
      http.get(`${API_BASE_URL}/api/loans/workbench/graph`, () => HttpResponse.json({
        message: 'DAG workbench is not enabled for scope \'personal-loan\'',
      }, { status: 403 })),
      http.get(`${API_BASE_URL}/api/loans/workbench/graph/summary`, () => HttpResponse.json({
        message: 'DAG workbench is not enabled for scope \'personal-loan\'',
      }, { status: 403 })),
    )

    renderWithProviders(<Loans user={adminUser} />)

    await screen.findByText('Resumen operativo de prestamos')
    await userEvent.click(screen.getByRole('button', { name: 'Workbench DAG' }))

    expect(await screen.findByText(/DAG workbench is not enabled for scope/)).toBeInTheDocument()
  })
})
