import React from 'react'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { delay, http, HttpResponse } from 'msw'

import i18n from '@/i18n'
import { API_BASE_URL } from '@/lib/api/client'
import Reports from '@/pages/Reports/Reports'
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
      http.get(`${API_BASE_URL}/api/reports/recovered`, () => {
        requests.recovered += 1
        return HttpResponse.json({ data: { loans: [] } })
      }),
      http.get(`${API_BASE_URL}/api/reports/outstanding`, () => {
        requests.outstanding += 1
        return HttpResponse.json({ data: { loans: [] } })
      }),
      http.get(`${API_BASE_URL}/api/associates`, () => HttpResponse.json({ data: { associates: [] } })),
      http.get(`${API_BASE_URL}/api/users`, () => {
        requests.users += 1
        return HttpResponse.json({ data: [] })
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
      http.get(`${API_BASE_URL}/api/reports/recovered`, () => HttpResponse.json({ data: { loans: [] } })),
      http.get(`${API_BASE_URL}/api/reports/outstanding`, () => HttpResponse.json({ data: { loans: [] } })),
      http.get(`${API_BASE_URL}/api/associates`, () => HttpResponse.json({ data: { associates: [] } })),
    )

    renderWithProviders(<Reports user={adminUser} />)

    expect(await screen.findByText('No se pudieron cargar los reportes')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Intentar de nuevo' }))

    expect(await screen.findByText('Espacio de reportes')).toBeInTheDocument()
    expect(recoveryAttempts).toBe(2)
  })
})
