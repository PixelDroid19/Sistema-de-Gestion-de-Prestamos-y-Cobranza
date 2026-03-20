import React from 'react'
import { screen } from '@testing-library/react'
import { delay, http, HttpResponse } from 'msw'

import i18n from '@/i18n'
import { API_BASE_URL } from '@/lib/api/client'
import Loans from '@/pages/Loans/Loans'
import { renderWithProviders } from '@/test/renderWithProviders'
import { server } from '@/test/msw/server'

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
    server.use(
      http.get(`${API_BASE_URL}/api/loans/customer/${customerUser.id}`, async () => {
        await delay(80)
        return HttpResponse.json({ data: { loans: [] } })
      }),
    )

    renderWithProviders(<Loans user={customerUser} />)

    expect(screen.getByText('Espacio de prestamos')).toBeInTheDocument()
    expect(await screen.findByText('Cargando prestamos')).toBeInTheDocument()
    expect(await screen.findByText('Crear una nueva solicitud')).toBeInTheDocument()
    expect(await screen.findByText('Aun no tienes prestamos')).toBeInTheDocument()
    expect(screen.getByText('Tu historial de prestamos')).toBeInTheDocument()
  })

  it('renders portfolio and servicing sections from live workspace queries', async () => {
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
      http.get(`${API_BASE_URL}/api/loans/${adminLoan.id}/attachments`, () => HttpResponse.json({
        data: { attachments: [{ id: 44, originalName: 'loan-note.pdf', category: 'note', customerVisible: false }] },
      })),
      http.get(`${API_BASE_URL}/api/customers/${adminLoan.customerId}/documents`, () => HttpResponse.json({
        data: { documents: [{ id: 33, originalName: 'kyc.pdf', category: 'kyc', customerVisible: true }] },
      })),
      http.get(`${API_BASE_URL}/api/reports/customer-history/${adminLoan.customerId}`, () => HttpResponse.json({
        data: {
          segments: {
            loans: [{ id: adminLoan.id }],
            payments: [{ id: 9001 }],
            documents: [{ id: 33 }],
            notifications: [{ id: 5 }],
          },
          timeline: [{ id: 'evt-1', eventType: 'loan_created', entityType: 'loan', occurredAt: '2026-03-01T00:00:00.000Z' }],
        },
      })),
    )

    renderWithProviders(<Loans user={adminUser} />)

    expect(await screen.findByText('Resumen operativo de prestamos')).toBeInTheDocument()
    expect(await screen.findByText('Promesas, adjuntos, documentos del cliente e historial')).toBeInTheDocument()
    expect(await screen.findByText('Acme Corp')).toBeInTheDocument()
    expect(screen.getByText('Alertas: 1')).toBeInTheDocument()
    expect(screen.getByText('Docs cliente: 1')).toBeInTheDocument()
  })

  it('shows the portfolio error state when loan loading fails', async () => {
    server.use(
      http.get(`${API_BASE_URL}/api/loans`, () => HttpResponse.json({ message: 'Broken' }, { status: 500 })),
    )

    renderWithProviders(<Loans user={adminUser} />)

    expect(await screen.findByText('No se pudieron cargar los prestamos')).toBeInTheDocument()
    expect(screen.getByText('Server error. Please try again later.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Intentar de nuevo' })).toBeInTheDocument()
  })
})
