import React from 'react'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'

import i18n from '@/i18n'
import { API_BASE_URL } from '@/lib/api/client'
import Agents from '@/pages/Agents/Agents'
import { renderWithProviders } from '@tests/test/renderWithProviders'
import { server } from '@tests/test/msw/server'

describe('Agents page', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('es')
  })

  it('renders roster data from the real query layer', async () => {
    server.use(
      http.get(`${API_BASE_URL}/api/agents`, () => HttpResponse.json({
        data: [
          { id: 8, name: 'Marta Reyes', email: 'marta@lendflow.test', phone: '+57 320 000 0001', isActive: true },
          { id: 9, name: 'Diego Mora', email: 'diego@lendflow.test', phone: '+57 320 000 0002', isActive: false },
        ],
      })),
    )

    renderWithProviders(<Agents />)

    expect(await screen.findByRole('heading', { name: 'Gestiona el equipo de cobranza desde un roster listo para workspace' })).toBeInTheDocument()
    expect(screen.getByText('Marta Reyes')).toBeInTheDocument()
    expect(screen.getByText('Diego Mora')).toBeInTheDocument()
    expect(screen.getByText('Activo')).toBeInTheDocument()
    expect(screen.getByText('Inactivo')).toBeInTheDocument()
  })

  it('creates an agent through the admin provisioning flow and refreshes the roster', async () => {
    const adminRegisterSpy = vi.fn(async () => HttpResponse.json({ data: { id: 12 } }))
    let agentsResponse = [{ id: 8, name: 'Marta Reyes', email: 'marta@lendflow.test', phone: '+57 320 000 0001', isActive: true }]

    server.use(
      http.get(`${API_BASE_URL}/api/agents`, () => HttpResponse.json({ data: agentsResponse })),
      http.post(`${API_BASE_URL}/api/auth/admin/register`, async ({ request }) => {
        const body = await request.json()
        adminRegisterSpy(body)
        agentsResponse = [...agentsResponse, { id: 12, name: body.name, email: body.email, phone: body.phone, isActive: true }]
        return HttpResponse.json({ data: { id: 12 } })
      }),
    )

    renderWithProviders(<Agents />)

    await screen.findByText('Marta Reyes')
    await userEvent.click(screen.getByRole('button', { name: 'Agregar nuevo agente' }))

    await userEvent.type(screen.getByLabelText('Nombre completo'), 'Laura Medina')
    await userEvent.type(screen.getByLabelText('Correo'), 'laura@lendflow.test')
    await userEvent.type(screen.getByLabelText('Telefono'), '+57 300 123 1234')
    await userEvent.type(screen.getByLabelText('Contrasena temporal'), 'secret123')
    await userEvent.click(screen.getByRole('button', { name: 'Crear agente' }))

    await waitFor(() => {
      expect(adminRegisterSpy).toHaveBeenCalledWith({
        name: 'Laura Medina',
        email: 'laura@lendflow.test',
        password: 'secret123',
        phone: '+57 300 123 1234',
        role: 'agent',
      })
    })

    expect(await screen.findByText('Laura Medina')).toBeInTheDocument()
    expect(screen.getByText('Agente creado correctamente!')).toBeInTheDocument()
  })
})
