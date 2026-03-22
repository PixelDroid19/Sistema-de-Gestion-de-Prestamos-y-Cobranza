import React from 'react'
import { screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'

import i18n from '@/i18n'
import { API_BASE_URL } from '@/lib/api/client'
import Dashboard from '@/pages/Dashboard/Dashboard'
import { renderWithProviders } from '@tests/test/renderWithProviders'
import { server } from '@tests/test/msw/server'

describe('Dashboard page', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('es')
  })

  it('renders admin dashboard metrics from live queries', async () => {
    const requests = {
      summary: 0,
      loans: 0,
      payments: 0,
    }

    server.use(
      http.get(`${API_BASE_URL}/api/reports/dashboard`, () => {
        requests.summary += 1
        return HttpResponse.json({
          data: {
            summary: {
              totalPortfolioAmount: 25000,
              totalRecoveredAmount: 12000,
              totalOutstandingAmount: 13000,
            },
          },
        })
      }),
      http.get(`${API_BASE_URL}/api/loans`, () => {
        requests.loans += 1
        return HttpResponse.json({ data: { loans: [] } })
      }),
      http.get(`${API_BASE_URL}/api/payments`, () => {
        requests.payments += 1
        return HttpResponse.json({ data: [] })
      }),
    )

    renderWithProviders(<Dashboard user={{ id: 1, role: 'admin', name: 'Ada Admin' }} />)

    expect(await screen.findByRole('heading', { name: 'Mantiene prestamos, recuperacion y planeacion dentro de una sola cabina financiera' })).toBeInTheDocument()
    expect(screen.getByText('Cartera monitoreada')).toBeInTheDocument()
    expect(screen.getByText('Caja recuperada')).toBeInTheDocument()
    expect(screen.getByText('Saldo pendiente')).toBeInTheDocument()
    expect(screen.getAllByText('$25,000.00')).toHaveLength(2)
    expect(screen.getByText('$12,000.00')).toBeInTheDocument()
    expect(screen.getByText('$13,000.00')).toBeInTheDocument()
    expect(requests).toEqual({ summary: 1, loans: 1, payments: 1 })
  })

  it('derives customer metrics from customer loans without calling admin-only endpoints', async () => {
    const requests = {
      summary: 0,
      customerLoans: 0,
      payments: 0,
    }

    server.use(
      http.get(`${API_BASE_URL}/api/reports/dashboard`, () => {
        requests.summary += 1
        return HttpResponse.json({ data: { summary: {} } })
      }),
      http.get(`${API_BASE_URL}/api/loans/customer/7`, () => {
        requests.customerLoans += 1
        return HttpResponse.json({
          data: {
            loans: [
              { id: 1, amount: 12000 },
              { id: 2, amount: 8000 },
            ],
          },
        })
      }),
      http.get(`${API_BASE_URL}/api/payments`, () => {
        requests.payments += 1
        return HttpResponse.json({ data: [] })
      }),
    )

    renderWithProviders(<Dashboard user={{ id: 7, role: 'customer', name: 'Ana Customer' }} />)

    expect(await screen.findAllByText('$20,000.00')).toHaveLength(2)
    expect(screen.getByText('$4,465.00')).toBeInTheDocument()
    expect(requests).toEqual({ summary: 0, customerLoans: 1, payments: 0 })
  })
})
