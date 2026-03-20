import React from 'react'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'

import i18n from '@/i18n'
import { API_BASE_URL } from '@/lib/api/client'
import Dashboard from '@/pages/Dashboard/Dashboard'
import { renderWithProviders } from '@/test/renderWithProviders'
import { server } from '@/test/msw/server'

describe('Dashboard page', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('es')
  })

  it('renders admin dashboard metrics from live queries', async () => {
    server.use(
      http.get(`${API_BASE_URL}/api/reports/dashboard`, () => HttpResponse.json({
        data: {
          summary: {
            totalPortfolioAmount: 25000,
            totalRecoveredAmount: 12000,
            totalOutstandingAmount: 13000,
          },
        },
      })),
      http.get(`${API_BASE_URL}/api/loans`, () => HttpResponse.json({ data: { loans: [] } })),
      http.get(`${API_BASE_URL}/api/payments`, () => HttpResponse.json({ data: [] })),
    )

    renderWithProviders(<Dashboard user={{ id: 1, role: 'admin', name: 'Ada Admin' }} />)

    expect(await screen.findByRole('heading', { name: 'Mantiene prestamos, recuperacion y planeacion dentro de una sola cabina financiera' })).toBeInTheDocument()
    expect(screen.getByText('Cartera monitoreada')).toBeInTheDocument()
    expect(screen.getByText('Caja recuperada')).toBeInTheDocument()
    expect(screen.getByText('Saldo pendiente')).toBeInTheDocument()
    expect(screen.getAllByText('$25,000.00')).toHaveLength(2)
    expect(screen.getByText('$12,000.00')).toBeInTheDocument()
    expect(screen.getByText('$13,000.00')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mes' })).toBeInTheDocument()
  })

  it('updates the visible profit filter labels without breaking rendering', async () => {
    server.use(
      http.get(`${API_BASE_URL}/api/reports/dashboard`, () => HttpResponse.json({
        data: {
          summary: {
            totalPortfolioAmount: 25000,
            totalRecoveredAmount: 12000,
            totalOutstandingAmount: 13000,
          },
        },
      })),
      http.get(`${API_BASE_URL}/api/loans`, () => HttpResponse.json({ data: { loans: [] } })),
      http.get(`${API_BASE_URL}/api/payments`, () => HttpResponse.json({ data: [] })),
    )

    renderWithProviders(<Dashboard user={{ id: 1, role: 'admin', name: 'Ada Admin' }} />)

    await screen.findByText('Cartera monitoreada')
    const yearFilter = screen.getAllByRole('button', { name: 'Ano' })[0]
    await userEvent.click(yearFilter)

    expect(yearFilter).toHaveClass('active')
    expect(screen.getByText('Ultimas transacciones')).toBeInTheDocument()
  })
})
