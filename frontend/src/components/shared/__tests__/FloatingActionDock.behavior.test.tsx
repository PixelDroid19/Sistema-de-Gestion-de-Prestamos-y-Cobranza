import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FloatingActionDock } from '../FloatingActionDock';
import { ActionButton } from '../Surfaces';

describe('FloatingActionDock', () => {
  it('renders a fixed toolbar shell with layout-specific grid columns', () => {
    const { container } = render(
      <FloatingActionDock layout="actions" itemCount={2} ariaLabel="Acciones de prueba">
        <ActionButton>Registrar pago</ActionButton>
        <ActionButton>Pago total</ActionButton>
      </FloatingActionDock>,
    );

    const dock = container.querySelector('[data-count="2"]');
    expect(dock).toHaveClass('floating-action-dock');
    expect(dock).toHaveClass('floating-action-dock--layout-actions');
    expect(screen.getByRole('toolbar', { name: 'Acciones de prueba' })).toBeInTheDocument();
  });
});
