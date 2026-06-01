import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RowActionToolbar } from '../RowActionToolbar';

describe('RowActionToolbar', () => {
  it('uses installment toolbar classes for credit detail row actions', () => {
    render(
      <RowActionToolbar variant="installment" ariaLabel="Acciones de prueba">
        <button type="button">A</button>
      </RowActionToolbar>,
    );

    const toolbar = screen.getByRole('toolbar', { name: 'Acciones de prueba' });
    expect(toolbar).toHaveClass('credit-installment-actions');
  });

  it('uses icon toolbar classes for operational list row actions', () => {
    render(
      <RowActionToolbar variant="icon" ariaLabel="Acciones de prueba">
        <button type="button">A</button>
      </RowActionToolbar>,
    );

    const toolbar = screen.getByRole('toolbar', { name: 'Acciones de prueba' });
    expect(toolbar).not.toHaveClass('credit-installment-actions');
    expect(toolbar).toHaveClass('gap-2');
  });
});
