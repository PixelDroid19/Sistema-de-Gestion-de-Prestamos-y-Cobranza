import React from 'react'
import { render, screen } from '@testing-library/react'

import Button from '@/components/ui/Button'

describe('Button', () => {
  it('defaults to a button type to avoid accidental form submits', () => {
    render(<Button>Accion secundaria</Button>)

    expect(screen.getByRole('button', { name: 'Accion secundaria' })).toHaveAttribute('type', 'button')
  })

  it('preserves an explicit submit type for real form submits', () => {
    render(<Button type="submit">Guardar</Button>)

    expect(screen.getByRole('button', { name: 'Guardar' })).toHaveAttribute('type', 'submit')
  })
})
