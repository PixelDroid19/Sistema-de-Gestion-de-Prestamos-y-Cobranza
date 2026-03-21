import React from 'react'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { delay, http, HttpResponse } from 'msw'

import i18n from '@/i18n'
import { API_BASE_URL } from '@/lib/api/client'
import Loans from '@/pages/Loans/Loans'
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
  })

  it('renders portfolio and servicing sections from live workspace queries', async () => {
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
    expect(screen.getByText('Alertas: 1')).toBeInTheDocument()
    expect(screen.getByText('Docs cliente: 1')).toBeInTheDocument()
    expect(requests).toEqual({
      payments: 1,
      alerts: 1,
      promises: 1,
      attachments: 1,
      customerDocuments: 1,
      customerHistory: 1,
    })
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
})
