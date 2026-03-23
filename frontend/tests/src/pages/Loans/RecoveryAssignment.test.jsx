import React from 'react'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'

import i18n from '@/i18n'
import { API_BASE_URL } from '@/lib/api/client'
import Loans from '@/pages/Loans/Loans'
import { renderWithProviders } from '@tests/test/renderWithProviders'
import { server } from '@tests/test/msw/server'

describe('Recovery assignment in loans workspace', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('es')
  })

  it('assigns recovery ownership from the loans workspace using the renamed endpoint', async () => {
    const assignmentRequests = []
    const adminUser = { id: 1, role: 'admin', name: 'Ada Admin' }
    const recoveryLoan = {
      id: 611,
      customerId: 19,
      amount: 8000,
      interestRate: 2.3,
      termMonths: 12,
      status: 'approved',
      recoveryStatus: 'pending',
      Customer: { id: 19, name: 'Laura Medina' },
      financialSnapshot: {
        installmentAmount: 900,
        outstandingBalance: 3200,
        totalPayable: 9500,
        outstandingInstallments: 4,
      },
    }

    server.use(
      http.get(`${API_BASE_URL}/api/loans`, () => HttpResponse.json({ data: { loans: [recoveryLoan] } })),
      http.get(`${API_BASE_URL}/api/loans/recovery-roster`, () => HttpResponse.json({
        data: {
          recoveryRoster: [
          { id: 8, name: 'Marta Reyes', email: 'marta@lendflow.test', phone: '+57 320 000 0001', isActive: true },
          ],
        },
      })),
      http.get(`${API_BASE_URL}/api/payments/loan/${recoveryLoan.id}`, () => HttpResponse.json({ data: [] })),
      http.get(`${API_BASE_URL}/api/loans/${recoveryLoan.id}/alerts`, () => HttpResponse.json({ data: { alerts: [] } })),
      http.get(`${API_BASE_URL}/api/loans/${recoveryLoan.id}/promises`, () => HttpResponse.json({ data: { promises: [] } })),
      http.get(`${API_BASE_URL}/api/loans/${recoveryLoan.id}/attachments`, () => HttpResponse.json({ data: { attachments: [] } })),
      http.get(`${API_BASE_URL}/api/customers/${recoveryLoan.customerId}/documents`, () => HttpResponse.json({ data: { documents: [] } })),
      http.get(`${API_BASE_URL}/api/reports/customer-history/${recoveryLoan.customerId}`, () => HttpResponse.json({ data: { segments: {}, timeline: [] } })),
      http.patch(`${API_BASE_URL}/api/loans/${recoveryLoan.id}/recovery-assignment`, async ({ request }) => {
        assignmentRequests.push(await request.json())
        return HttpResponse.json({
          data: {
            loan: {
              ...recoveryLoan,
              agentId: 8,
              Agent: { id: 8, name: 'Marta Reyes' },
            },
          },
        })
      }),
    )

    renderWithProviders(<Loans user={adminUser} />)

    await screen.findByText('Laura Medina')
    const assignmentCell = screen.getByText('Laura Medina').closest('tr')
    const cellQueries = within(assignmentCell)

    await userEvent.selectOptions(cellQueries.getByRole('combobox'), '8')
    await userEvent.click(cellQueries.getByRole('button', { name: 'Asignar recuperacion' }))

    await waitFor(() => {
      expect(assignmentRequests).toEqual([{ recoveryAssigneeId: 8 }])
    })
    expect(await screen.findByText(/Responsable de recuperacion asignado correctamente\./)).toBeInTheDocument()
  })
})
