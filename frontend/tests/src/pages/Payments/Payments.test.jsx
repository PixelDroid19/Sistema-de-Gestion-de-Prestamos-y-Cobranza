import React from 'react'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { delay, http, HttpResponse } from 'msw'
import { vi } from 'vitest'

import i18n from '@/i18n'
import { API_BASE_URL } from '@/lib/api/client'
import Payments from '@/pages/Payments/Payments'
import { renderWithProviders } from '@tests/test/renderWithProviders'
import { server } from '@tests/test/msw/server'
import { getNearestCancellableInstallmentNumber } from '@/features/payments/paymentsWorkspace.utils'

const customerUser = { id: 7, role: 'customer', name: 'Ana Customer' }
const adminUser = { id: 1, role: 'admin', name: 'Ada Admin' }

const payableLoan = {
  id: 10,
  amount: 12000,
  interestRate: 12,
  termMonths: 12,
  status: 'approved',
  financialSnapshot: {
    installmentAmount: 1066.5,
    outstandingBalance: 8200,
  },
}

describe('Payments page', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('es')
  })

  it('mounts the real workspace and resolves selected-loan history into an empty state', async () => {
    const requests = {
      loans: 0,
      payments: 0,
      calendar: 0,
      attachments: 0,
    }

    server.use(
      http.get(`${API_BASE_URL}/api/loans/customer/${customerUser.id}`, async () => {
        requests.loans += 1
        await delay(60)
        return HttpResponse.json({ data: { loans: [payableLoan] } })
      }),
      http.get(`${API_BASE_URL}/api/loans/${payableLoan.id}`, () => HttpResponse.json({
        data: {
          loan: {
            ...payableLoan,
            paymentContext: {
              isPayable: true,
              allowedPaymentTypes: ['installment', 'payoff'],
              snapshot: { outstandingBalance: 8200, installmentAmount: 1066.5 },
              payoffEligibility: { allowed: true, denialReasons: [] },
              capitalEligibility: { allowed: false, denialReasons: [{ code: 'NO_OUTSTANDING_BALANCE' }] },
            },
          },
        },
      })),
      http.get(`${API_BASE_URL}/api/payments/loan/${payableLoan.id}`, async () => {
        requests.payments += 1
        await delay(60)
        return HttpResponse.json({
          data: {
            payments: [],
            loan: {
              ...payableLoan,
              paymentContext: {
                isPayable: true,
                allowedPaymentTypes: ['installment', 'payoff'],
                snapshot: { outstandingBalance: 8200, installmentAmount: 1066.5 },
                payoffEligibility: { allowed: true, denialReasons: [] },
                capitalEligibility: { allowed: false, denialReasons: [{ code: 'NO_OUTSTANDING_BALANCE' }] },
              },
            },
          },
        })
      }),
      http.get(`${API_BASE_URL}/api/loans/${payableLoan.id}/calendar`, () => {
        requests.calendar += 1
        return HttpResponse.json({
          data: { calendar: { entries: [] } },
        })
      }),
      http.get(`${API_BASE_URL}/api/loans/${payableLoan.id}/attachments`, () => {
        requests.attachments += 1
        return HttpResponse.json({
          data: { attachments: [] },
        })
      }),
    )

    renderWithProviders(<Payments user={customerUser} />)

    expect(screen.getByText('Cargando espacio de pagos')).toBeInTheDocument()
    expect(await screen.findByText('Sigue la actividad de cuotas desde una sola superficie compartida')).toBeInTheDocument()

    await userEvent.selectOptions(screen.getByLabelText('Prestamo'), String(payableLoan.id))

    expect(await screen.findByText('Aun no hay pagos')).toBeInTheDocument()
    expect(screen.getByText('Prestamo #10')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pagar cuota' })).toBeInTheDocument()
    expect(requests).toEqual({ loans: 1, payments: 1, calendar: 1, attachments: 1 })
  })

  it('retries history queries after the user requests another attempt', async () => {
    let paymentsAttempts = 0

    server.use(
      http.get(`${API_BASE_URL}/api/loans/customer/${customerUser.id}`, () => HttpResponse.json({ data: { loans: [payableLoan] } })),
      http.get(`${API_BASE_URL}/api/loans/${payableLoan.id}`, () => HttpResponse.json({
        data: {
          loan: {
            ...payableLoan,
            paymentContext: {
              isPayable: true,
              allowedPaymentTypes: ['installment', 'payoff'],
              snapshot: { outstandingBalance: 8200, installmentAmount: 1066.5 },
              payoffEligibility: { allowed: true, denialReasons: [] },
              capitalEligibility: { allowed: false, denialReasons: [] },
            },
          },
        },
      })),
      http.get(`${API_BASE_URL}/api/payments/loan/${payableLoan.id}`, () => {
        paymentsAttempts += 1

        if (paymentsAttempts === 1) {
          return HttpResponse.json({ message: 'Broken' }, { status: 500 })
        }

        return HttpResponse.json({
          data: {
            payments: [],
            loan: {
              ...payableLoan,
              paymentContext: {
                isPayable: true,
                allowedPaymentTypes: ['installment', 'payoff'],
                snapshot: { outstandingBalance: 8200, installmentAmount: 1066.5 },
                payoffEligibility: { allowed: true, denialReasons: [] },
                capitalEligibility: { allowed: false, denialReasons: [] },
              },
            },
          },
        })
      }),
      http.get(`${API_BASE_URL}/api/loans/${payableLoan.id}/calendar`, () => HttpResponse.json({ data: { calendar: { entries: [] } } })),
      http.get(`${API_BASE_URL}/api/loans/${payableLoan.id}/attachments`, () => HttpResponse.json({ data: { attachments: [] } })),
    )

    renderWithProviders(<Payments user={customerUser} />)

    expect(await screen.findByText('Sigue la actividad de cuotas desde una sola superficie compartida')).toBeInTheDocument()

    await userEvent.selectOptions(screen.getByLabelText('Prestamo'), String(payableLoan.id))

    expect(await screen.findByText('No se pudieron cargar los pagos')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Intentar de nuevo' }))

    await waitFor(() => {
      expect(screen.queryByText('No se pudieron cargar los pagos')).not.toBeInTheDocument()
    })
    expect(screen.getByText('Prestamo #10')).toBeInTheDocument()
    expect(paymentsAttempts).toBe(2)
  })

  it('supports payment document listing, upload, and download for internal users', async () => {
    const uploadedDocuments = []
    const clickSpy = vi.fn()
    if (!URL.createObjectURL) {
      URL.createObjectURL = () => 'blob:default'
    }
    if (!URL.revokeObjectURL) {
      URL.revokeObjectURL = () => {}
    }
    const createObjectUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:payment-document')
    const revokeObjectUrlSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const originalCreateElement = document.createElement.bind(document)
    let downloadLink = null

    vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
      if (tagName === 'a') {
        downloadLink = {
          click: clickSpy,
          href: '',
          download: '',
        }
        return downloadLink
      }

      return originalCreateElement(tagName)
    })

    server.use(
      http.get(`${API_BASE_URL}/api/loans`, () => HttpResponse.json({ data: { loans: [payableLoan] } })),
      http.get(`${API_BASE_URL}/api/loans/${payableLoan.id}`, () => HttpResponse.json({
        data: {
          loan: {
            ...payableLoan,
            paymentContext: {
              isPayable: true,
              allowedPaymentTypes: ['installment', 'partial', 'capital'],
              snapshot: { outstandingBalance: 8200, installmentAmount: 1066.5 },
              payoffEligibility: { allowed: true, denialReasons: [] },
              capitalEligibility: { allowed: true, denialReasons: [] },
            },
          },
        },
      })),
      http.get(`${API_BASE_URL}/api/payments/loan/${payableLoan.id}`, () => HttpResponse.json({
        data: {
          payments: [
            {
              id: 301,
              loanId: payableLoan.id,
              amount: 1066.5,
              paymentType: 'installment',
              createdAt: '2026-03-20T00:00:00.000Z',
              status: 'completed',
            },
          ],
          loan: {
            ...payableLoan,
            paymentContext: {
              isPayable: true,
              allowedPaymentTypes: ['installment', 'partial', 'capital'],
              snapshot: { outstandingBalance: 8200, installmentAmount: 1066.5 },
              payoffEligibility: { allowed: true, denialReasons: [] },
              capitalEligibility: { allowed: true, denialReasons: [] },
            },
          },
        },
      })),
      http.get(`${API_BASE_URL}/api/loans/${payableLoan.id}/calendar`, () => HttpResponse.json({
        data: { calendar: { entries: [] } },
      })),
      http.get(`${API_BASE_URL}/api/loans/${payableLoan.id}/attachments`, () => HttpResponse.json({
        data: { attachments: [] },
      })),
      http.get(`${API_BASE_URL}/api/payments/301/documents`, () => HttpResponse.json({
        data: {
          documents: [
            { id: 401, originalName: 'receipt.pdf', category: 'receipt', customerVisible: true },
          ],
        },
      })),
      http.post(`${API_BASE_URL}/api/payments/301/documents`, () => {
        uploadedDocuments.push({
          fileName: 'payment-proof.pdf',
          category: 'receipt',
          description: 'Comprobante bancario',
          customerVisible: 'true',
        })
        return HttpResponse.json({ data: { document: { id: 402 } } }, { status: 201 })
      }),
      http.get(`${API_BASE_URL}/api/payments/301/documents/401/download`, () => new HttpResponse('payment-document', {
        headers: {
          'Content-Type': 'application/pdf',
        },
      })),
    )

    renderWithProviders(<Payments user={adminUser} />)

    expect(await screen.findByText('Sigue la actividad de cuotas desde una sola superficie compartida')).toBeInTheDocument()

    await userEvent.selectOptions(screen.getByLabelText('Prestamo'), String(payableLoan.id))

    const historySection = screen.getByText('Transacciones recientes').closest('section')
    const historyQueries = within(historySection)

    expect(await historyQueries.findByText('receipt.pdf')).toBeInTheDocument()

    const file = new File(['payment proof'], 'payment-proof.pdf', { type: 'application/pdf' })
    await userEvent.upload(historyQueries.getByLabelText('Documento del pago'), file)
    await userEvent.type(historyQueries.getByLabelText('Categoria'), 'receipt')
    await userEvent.type(historyQueries.getByLabelText('Descripcion'), 'Comprobante bancario')
    await userEvent.click(historyQueries.getByRole('checkbox'))
    await userEvent.click(historyQueries.getByRole('button', { name: 'Subir documento' }))

    await waitFor(() => {
      expect(screen.getByText(/Documento del pago cargado correctamente\./)).toBeInTheDocument()
    })
    expect(uploadedDocuments).toEqual([
      {
        fileName: 'payment-proof.pdf',
        category: 'receipt',
        description: 'Comprobante bancario',
        customerVisible: 'true',
      },
    ])

    await userEvent.click(historyQueries.getByRole('button', { name: 'Descargar' }))

    expect(clickSpy).toHaveBeenCalledTimes(1)
    expect(createObjectUrlSpy).toHaveBeenCalledTimes(1)
    expect(revokeObjectUrlSpy).toHaveBeenCalledWith('blob:payment-document')
    expect(downloadLink.download).toBe('receipt.pdf')
  })

  it('wires the migrated installment calendar surface to live loan calendar data', async () => {
    server.use(
      http.get(`${API_BASE_URL}/api/loans/customer/${customerUser.id}`, () => HttpResponse.json({ data: { loans: [payableLoan] } })),
      http.get(`${API_BASE_URL}/api/loans/${payableLoan.id}`, () => HttpResponse.json({
        data: {
          loan: {
            ...payableLoan,
            paymentContext: {
              isPayable: true,
              allowedPaymentTypes: ['installment', 'payoff'],
              snapshot: { outstandingBalance: 8200, installmentAmount: 1066.5 },
              payoffEligibility: { allowed: true, denialReasons: [] },
              capitalEligibility: { allowed: false, denialReasons: [] },
            },
          },
        },
      })),
      http.get(`${API_BASE_URL}/api/payments/loan/${payableLoan.id}`, () => HttpResponse.json({
        data: {
          payments: [],
          loan: {
            ...payableLoan,
            paymentContext: {
              isPayable: true,
              allowedPaymentTypes: ['installment', 'payoff'],
              snapshot: { outstandingBalance: 8200, installmentAmount: 1066.5 },
              payoffEligibility: { allowed: true, denialReasons: [] },
              capitalEligibility: { allowed: false, denialReasons: [] },
            },
          },
        },
      })),
      http.get(`${API_BASE_URL}/api/loans/${payableLoan.id}/calendar`, () => HttpResponse.json({
        data: {
          calendar: {
            entries: [
              {
                installmentNumber: 1,
                dueDate: '2026-03-28T00:00:00.000Z',
                outstandingAmount: 1200,
                status: 'overdue',
              },
            ],
          },
        },
      })),
      http.get(`${API_BASE_URL}/api/loans/${payableLoan.id}/attachments`, () => HttpResponse.json({ data: { attachments: [] } })),
    )

    renderWithProviders(<Payments user={customerUser} />)

    expect(await screen.findByText('Sigue la actividad de cuotas desde una sola superficie compartida')).toBeInTheDocument()

    await userEvent.selectOptions(screen.getByLabelText('Prestamo'), String(payableLoan.id))

    expect(await screen.findByText('Calendario de cuotas')).toBeInTheDocument()
    expect(screen.getByText('Cuota #1 · Vencida · ₹1200.00')).toBeInTheDocument()
  })

  it('shows the annul action on the nearest backend-cancellable installment after a partial payment exists', async () => {
    server.use(
      http.get(`${API_BASE_URL}/api/loans`, () => HttpResponse.json({ data: { loans: [payableLoan] } })),
      http.get(`${API_BASE_URL}/api/loans/${payableLoan.id}`, () => HttpResponse.json({
        data: {
          loan: {
            ...payableLoan,
            paymentContext: {
              isPayable: true,
              allowedPaymentTypes: ['installment', 'partial', 'capital'],
              snapshot: { outstandingBalance: 8050, installmentAmount: 1066.5 },
              payoffEligibility: { allowed: true, denialReasons: [] },
              capitalEligibility: { allowed: true, denialReasons: [] },
            },
          },
        },
      })),
      http.get(`${API_BASE_URL}/api/payments/loan/${payableLoan.id}`, () => HttpResponse.json({
        data: {
          payments: [
            {
              id: 777,
              loanId: payableLoan.id,
              amount: 150,
              paymentType: 'partial',
              createdAt: '2026-03-22T00:00:00.000Z',
              status: 'completed',
            },
          ],
          loan: {
            ...payableLoan,
            paymentContext: {
              isPayable: true,
              allowedPaymentTypes: ['installment', 'partial', 'capital'],
              snapshot: { outstandingBalance: 8050, installmentAmount: 1066.5 },
              payoffEligibility: { allowed: true, denialReasons: [] },
              capitalEligibility: { allowed: true, denialReasons: [] },
            },
          },
        },
      })),
      http.get(`${API_BASE_URL}/api/loans/${payableLoan.id}/calendar`, () => HttpResponse.json({
        data: {
          calendar: {
            entries: [
              {
                installmentNumber: 1,
                dueDate: '2026-04-21T00:00:00.000Z',
                outstandingAmount: 916.5,
                status: 'partial',
              },
              {
                installmentNumber: 2,
                dueDate: '2026-05-21T00:00:00.000Z',
                outstandingAmount: 1066.5,
                status: 'pending',
              },
            ],
          },
        },
      })),
      http.get(`${API_BASE_URL}/api/loans/${payableLoan.id}/attachments`, () => HttpResponse.json({ data: { attachments: [] } })),
      http.get(`${API_BASE_URL}/api/payments/777/documents`, () => HttpResponse.json({ data: { documents: [] } })),
    )

    renderWithProviders(<Payments user={adminUser} />)

    expect(await screen.findByText('Sigue la actividad de cuotas desde una sola superficie compartida')).toBeInTheDocument()

    await userEvent.selectOptions(screen.getByLabelText('Prestamo'), String(payableLoan.id))

    expect(await screen.findByText('No hay documentos del pago disponibles')).toBeInTheDocument()

    const rows = screen.getAllByRole('row')
    const partialInstallmentRow = rows.find((row) => within(row).queryByText('#1'))
    const pendingInstallmentRow = rows.find((row) => within(row).queryByText('#2'))

    expect(partialInstallmentRow).toBeTruthy()
    expect(pendingInstallmentRow).toBeTruthy()
    expect(within(partialInstallmentRow).queryByRole('button', { name: 'Anular' })).not.toBeInTheDocument()
    expect(within(pendingInstallmentRow).queryByRole('button', { name: 'Anular' })).not.toBeInTheDocument()
  })
})

describe('getNearestCancellableInstallmentNumber', () => {
  it('returns null when an earlier partial installment still blocks annulment', () => {
    expect(getNearestCancellableInstallmentNumber([
      { installmentNumber: 1, outstandingAmount: 924.46, status: 'partial' },
      { installmentNumber: 2, outstandingAmount: 1074.46, status: 'pending' },
      { installmentNumber: 3, outstandingAmount: 1074.46, status: 'pending' },
    ])).toBeNull()
  })
})
