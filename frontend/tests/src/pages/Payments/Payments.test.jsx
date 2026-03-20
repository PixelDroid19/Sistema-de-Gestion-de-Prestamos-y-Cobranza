import React from 'react'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { delay, http, HttpResponse } from 'msw'

import i18n from '@/i18n'
import { API_BASE_URL } from '@/lib/api/client'
import Payments from '@/pages/Payments/Payments'
import { renderWithProviders } from '@tests/test/renderWithProviders'
import { server } from '@tests/test/msw/server'

const customerUser = { id: 7, role: 'customer', name: 'Ana Customer' }

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
      http.get(`${API_BASE_URL}/api/payments/loan/${payableLoan.id}`, async () => {
        requests.payments += 1
        await delay(60)
        return HttpResponse.json({ data: [] })
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
      http.get(`${API_BASE_URL}/api/payments/loan/${payableLoan.id}`, () => {
        paymentsAttempts += 1

        if (paymentsAttempts === 1) {
          return HttpResponse.json({ message: 'Broken' }, { status: 500 })
        }

        return HttpResponse.json({ data: [] })
      }),
      http.get(`${API_BASE_URL}/api/loans/${payableLoan.id}/calendar`, () => HttpResponse.json({ data: { calendar: { entries: [] } } })),
      http.get(`${API_BASE_URL}/api/loans/${payableLoan.id}/attachments`, () => HttpResponse.json({ data: { attachments: [] } })),
    )

    renderWithProviders(<Payments user={customerUser} />)

    expect(await screen.findByText('Sigue la actividad de cuotas desde una sola superficie compartida')).toBeInTheDocument()

    await userEvent.selectOptions(screen.getByLabelText('Prestamo'), String(payableLoan.id))

    expect(await screen.findByText('No se pudieron cargar los pagos')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Intentar de nuevo' }))

    await screen.findByRole('button', { name: 'Intentar de nuevo' })
    expect(screen.getByText('Prestamo #10')).toBeInTheDocument()
    expect(paymentsAttempts).toBe(2)
  })
})
