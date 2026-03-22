import React from 'react'
import { screen } from '@testing-library/react'
import { vi } from 'vitest'

import i18n from '@/i18n'
import Associates from '@/pages/Associates/Associates'
import { renderWithProviders } from '@tests/test/renderWithProviders'

const { mockUseAssociatesQuery } = vi.hoisted(() => ({
  mockUseAssociatesQuery: vi.fn(),
}))

vi.mock('@/hooks/useAssociates', () => ({
  useAssociatesQuery: (...args) => mockUseAssociatesQuery(...args),
}))

describe('Associates page', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('es')
    mockUseAssociatesQuery.mockReset()
  })

  it('renders the migrated associates workspace from the real query layer', async () => {
    mockUseAssociatesQuery.mockReturnValue({
      data: {
        items: [
          {
            id: 8,
            name: 'Socio Capital',
            email: 'socio@lendflow.test',
            status: 'active',
            participationPercentage: 35,
            activeLoanCount: 4,
          },
        ],
      },
    })

    renderWithProviders(<Associates />)

    expect(mockUseAssociatesQuery).toHaveBeenCalledWith({ pagination: { page: 1, pageSize: 50 } })
    expect(await screen.findByRole('heading', { name: 'Espacio de socios' })).toBeInTheDocument()
    expect(screen.getByText('Socio Capital')).toBeInTheDocument()
    expect(screen.getByText('35%')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Nuevo socio' })).toBeInTheDocument()
  })
})
