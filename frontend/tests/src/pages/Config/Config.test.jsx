import React from 'react'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { vi } from 'vitest'

import i18n from '@/i18n'
import { API_BASE_URL } from '@/lib/api/client'
import Config from '@/pages/Config/Config'
import { useSessionStore } from '@/store/sessionStore'
import { renderWithProviders } from '@tests/test/renderWithProviders'
import { server } from '@tests/test/msw/server'

const adminUser = { id: 1, role: 'admin', name: 'Ada Admin', email: 'ada@lendflow.test' }
const customerUser = { id: 7, role: 'customer', name: 'Ana Customer', email: 'ana@lendflow.test' }

describe('Config page', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('es')
    window.localStorage.clear()

    useSessionStore.setState({
      user: adminUser,
      token: 'token-admin',
      isReady: true,
      bootstrapSession: vi.fn(),
      logout: vi.fn(),
      syncUser: vi.fn(),
    })
  })

  it('lets admins create payment methods from the Configuración workspace and refreshes the catalog', async () => {
    const paymentMethods = []
    const settings = [
      { id: 21, key: 'company-name', label: 'Nombre de la compania', value: 'LendFlow SAS', description: 'Exportes' },
    ]
    const requests = { list: 0, create: 0 }

    server.use(
      http.get(`${API_BASE_URL}/api/config/payment-methods`, () => {
        requests.list += 1
        return HttpResponse.json({ data: { paymentMethods } })
      }),
      http.post(`${API_BASE_URL}/api/config/payment-methods`, async ({ request }) => {
        requests.create += 1
        const payload = await request.json()
        paymentMethods.push({
          id: 31,
          label: payload.label,
          key: payload.key,
          description: payload.description || '',
          requiresReference: Boolean(payload.requiresReference),
          isActive: payload.isActive !== false,
        })

        return HttpResponse.json({
          success: true,
          message: 'Payment method created successfully',
          data: { paymentMethod: paymentMethods[0] },
        }, { status: 201 })
      }),
      http.get(`${API_BASE_URL}/api/config/settings`, () => HttpResponse.json({ data: { settings } })),
      http.get(`${API_BASE_URL}/api/config/catalogs`, () => HttpResponse.json({ data: { catalogs: { roles: ['admin', 'customer', 'socio'] } } })),
      http.get(`${API_BASE_URL}/api/users`, () => HttpResponse.json({
        data: { users: [], pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0 } },
      })),
      http.get(`${API_BASE_URL}/api/auth/profile`, () => HttpResponse.json({ data: { user: adminUser } })),
    )

    const { container } = renderWithProviders(<Config user={adminUser} />)

    expect(await screen.findByText('CRUD de metodos de pago')).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('Nombre'), 'Transferencia bancaria')
    await userEvent.type(screen.getByLabelText('Clave'), 'transferencia-bancaria')
    await userEvent.type(screen.getByLabelText('Descripcion'), 'Requiere comprobante')
    await userEvent.click(screen.getByRole('button', { name: 'Crear metodo' }))

    await waitFor(() => {
      expect(container.querySelector('.inline-message--success')?.textContent).toContain('Metodo de pago creado correctamente.')
    })
    expect(await screen.findByText('Transferencia bancaria')).toBeInTheDocument()
    expect(screen.getByText('transferencia-bancaria')).toBeInTheDocument()

    await waitFor(() => {
      expect(requests.create).toBe(1)
      expect(requests.list).toBeGreaterThanOrEqual(2)
    })
  })

  it('lets admins change their password from Configuración', async () => {
    let passwordChangePayload = null

    server.use(
      http.get(`${API_BASE_URL}/api/config/payment-methods`, () => HttpResponse.json({ data: { paymentMethods: [] } })),
      http.get(`${API_BASE_URL}/api/config/settings`, () => HttpResponse.json({ data: { settings: [] } })),
      http.get(`${API_BASE_URL}/api/config/catalogs`, () => HttpResponse.json({ data: { catalogs: { roles: ['admin', 'customer', 'socio'] } } })),
      http.get(`${API_BASE_URL}/api/users`, () => HttpResponse.json({
        data: { users: [], pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0 } },
      })),
      http.get(`${API_BASE_URL}/api/auth/profile`, () => HttpResponse.json({ data: { user: adminUser } })),
      http.put(`${API_BASE_URL}/api/auth/password`, async ({ request }) => {
        passwordChangePayload = await request.json()
        return HttpResponse.json({ success: true, message: 'Password changed successfully' })
      }),
    )

    const { container } = renderWithProviders(<Config user={adminUser} />)

    expect(await screen.findByText('Cambiar contrasena del usuario autenticado')).toBeInTheDocument()

    const passwordSection = screen.getByText('Actualizar acceso').closest('section')
    const passwordQueries = within(passwordSection)

    await userEvent.type(passwordQueries.getByLabelText('Contrasena actual'), 'current-secret')
    await userEvent.type(passwordQueries.getByLabelText('Nueva contrasena'), 'next-secret')
    await userEvent.type(passwordQueries.getByLabelText('Confirmar nueva contrasena'), 'next-secret')
    await userEvent.click(passwordQueries.getByRole('button', { name: 'Actualizar contrasena' }))

    await waitFor(() => {
      expect(container.querySelector('.inline-message--success')?.textContent).toContain('Contrasena actualizada correctamente.')
    })
    expect(passwordChangePayload).toEqual({
      currentPassword: 'current-secret',
      nextPassword: 'next-secret',
    })
  })

  it('shows the in-app usuarios del sistema panel with role-based management actions', async () => {
    const rolePayloads = []
    const deactivatedUsers = []
    const reactivatedUsers = []
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

    server.use(
      http.get(`${API_BASE_URL}/api/config/payment-methods`, () => HttpResponse.json({ data: { paymentMethods: [] } })),
      http.get(`${API_BASE_URL}/api/config/settings`, () => HttpResponse.json({ data: { settings: [] } })),
      http.get(`${API_BASE_URL}/api/config/catalogs`, () => HttpResponse.json({ data: { catalogs: { roles: ['admin', 'customer', 'socio'] } } })),
      http.get(`${API_BASE_URL}/api/auth/profile`, () => HttpResponse.json({ data: { user: adminUser } })),
      http.get(`${API_BASE_URL}/api/users`, () => HttpResponse.json({
        data: {
          users: [
            { id: 3, name: 'Carla Customer', email: 'carla@lendflow.test', role: 'customer', isActive: true },
            { id: 4, name: 'Sam Socio', email: 'sam@lendflow.test', role: 'socio', isActive: false },
          ],
          pagination: { page: 1, pageSize: 10, totalItems: 2, totalPages: 1 },
        },
      })),
      http.put(`${API_BASE_URL}/api/users/3`, async ({ request }) => {
        rolePayloads.push(await request.json())
        return HttpResponse.json({ success: true, data: { id: 3, role: 'admin' } })
      }),
      http.post(`${API_BASE_URL}/api/users/3/deactivate`, () => {
        deactivatedUsers.push(3)
        return HttpResponse.json({ success: true, data: { id: 3, isActive: false } })
      }),
      http.post(`${API_BASE_URL}/api/users/4/reactivate`, () => {
        reactivatedUsers.push(4)
        return HttpResponse.json({ success: true, data: { id: 4, isActive: true } })
      }),
    )

    const { container } = renderWithProviders(<Config user={adminUser} />)

    expect(await screen.findByText('Administra usuarios visibles, roles y estado de acceso')).toBeInTheDocument()
    expect(screen.getByText('Carla Customer')).toBeInTheDocument()
    expect(screen.getByText('Sam Socio')).toBeInTheDocument()
    expect(screen.getByText('Modelo de acceso cargado desde catalogos')).toBeInTheDocument()
    expect(screen.getAllByText('Permisos granulares por usuario: no disponible').length).toBeGreaterThan(0)

    const carlaRow = screen.getByText('Carla Customer').closest('tr')
    const samRow = screen.getByText('Sam Socio').closest('tr')

    await userEvent.click(within(carlaRow).getByRole('button', { name: 'Editar rol' }))
    await userEvent.selectOptions(within(carlaRow).getByRole('combobox'), 'admin')
    await userEvent.click(within(carlaRow).getByRole('button', { name: 'Guardar' }))

    await waitFor(() => {
      expect(rolePayloads).toEqual([{ role: 'admin' }])
      expect(container.querySelector('.inline-message--success')?.textContent).toContain('Rol del usuario actualizado correctamente.')
    })

    await userEvent.click(within(carlaRow).getByRole('button', { name: 'Desactivar' }))
    await waitFor(() => {
      expect(deactivatedUsers).toEqual([3])
      expect(confirmSpy).toHaveBeenCalledWith('Desactivar al usuario Carla Customer?')
      expect(container.querySelector('.inline-message--success')?.textContent).toContain('Usuario desactivado correctamente.')
    })

    await userEvent.click(within(samRow).getByRole('button', { name: 'Reactivar' }))
    await waitFor(() => {
      expect(reactivatedUsers).toEqual([4])
      expect(container.querySelector('.inline-message--success')?.textContent).toContain('Usuario reactivado correctamente.')
    })
  })

  it('shows a restricted state for non-admin users without exposing config editors', async () => {
    useSessionStore.setState({
      user: customerUser,
      token: 'token-customer',
      isReady: true,
      bootstrapSession: vi.fn(),
      logout: vi.fn(),
      syncUser: vi.fn(),
    })

    renderWithProviders(<Config user={customerUser} />)

    expect(screen.getByText('Configuracion restringida')).toBeInTheDocument()
    expect(screen.getByText('Solo los administradores pueden administrar catalogos y ajustes del sistema.')).toBeInTheDocument()
    expect(screen.queryByText('CRUD de metodos de pago')).not.toBeInTheDocument()
  })
})
