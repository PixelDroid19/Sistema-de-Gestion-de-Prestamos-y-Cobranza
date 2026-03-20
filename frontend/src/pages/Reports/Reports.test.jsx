import React from 'react'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { delay, http, HttpResponse } from 'msw'

import i18n from '@/i18n'
import { API_BASE_URL } from '@/lib/api/client'
import Reports from '@/pages/Reports/Reports'
import { renderWithProviders } from '@/test/renderWithProviders'
import { server } from '@/test/msw/server'

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

  it('mounts the real admin workspace and switches through reporting sections', async () => {
    server.use(
      http.get(`${API_BASE_URL}/api/reports/recovery`, async () => {
        await delay(80)
        return HttpResponse.json(recoverySummaryResponse)
      }),
      http.get(`${API_BASE_URL}/api/reports/recovered`, () => HttpResponse.json({ data: { loans: [] } })),
      http.get(`${API_BASE_URL}/api/reports/outstanding`, () => HttpResponse.json({ data: { loans: [] } })),
      http.get(`${API_BASE_URL}/api/associates`, () => HttpResponse.json({ data: { associates: [] } })),
      http.get(`${API_BASE_URL}/api/users`, () => HttpResponse.json({ data: [] })),
    )

    renderWithProviders(<Reports user={adminUser} />)

    expect(screen.getByText('Cargando reportes')).toBeInTheDocument()
    expect(await screen.findByText('Espacio de reportes')).toBeInTheDocument()
    expect(screen.getByText('Saldos de cartera')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /Recuperados/i }))
    expect(await screen.findByText('Aun no hay prestamos recuperados')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /Pendientes/i }))
    expect(await screen.findByText('No hay prestamos pendientes')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /Usuarios/i }))
    expect(await screen.findByText('No se encontraron usuarios.')).toBeInTheDocument()
  })

  it('shows the reports error panel when the primary report query fails', async () => {
    server.use(
      http.get(`${API_BASE_URL}/api/reports/recovery`, () => HttpResponse.json({ message: 'Broken' }, { status: 500 })),
      http.get(`${API_BASE_URL}/api/associates`, () => HttpResponse.json({ data: { associates: [] } })),
    )

    renderWithProviders(<Reports user={adminUser} />)

    expect(await screen.findByText('No se pudieron cargar los reportes')).toBeInTheDocument()
    expect(screen.getByText('Server error. Please try again later.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Intentar de nuevo' })).toBeInTheDocument()
  })
})
