import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DollarSign, ShieldAlert } from 'lucide-react';
import { RowActionsWithOverflow } from '../RowActionsWithOverflow';
import { installmentActionClass } from '../tableActionStyles';

describe('RowActionsWithOverflow', () => {
  it('moves actions beyond maxInline into a more-actions menu', () => {
    const onPay = vi.fn();
    const onAnnul = vi.fn();

    render(
      <RowActionsWithOverflow
        variant="installment"
        maxInline={1}
        ariaLabel="Acciones de la cuota 1"
        menuAriaLabel="Más acciones de la cuota"
        items={[
          {
            id: 'pay',
            label: 'Registrar pago',
            icon: <DollarSign size={16} />,
            onClick: onPay,
            buttonClassName: installmentActionClass('blue'),
          },
          {
            id: 'annul',
            label: 'Anular cuota',
            icon: <ShieldAlert size={16} />,
            onClick: onAnnul,
            buttonClassName: installmentActionClass('rose'),
            menuTone: 'danger',
          },
        ]}
      />,
    );

    expect(screen.getByLabelText('Registrar pago')).toBeInTheDocument();
    expect(screen.queryByLabelText('Anular cuota')).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Más acciones de la cuota'));

    const annulInMenu = screen.getByRole('menuitem', { name: /Anular cuota/i });
    fireEvent.click(annulInMenu);

    expect(onAnnul).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('opens and closes the overflow menu when align is center', () => {
    render(
      <RowActionsWithOverflow
        variant="icon"
        align="center"
        maxInline={1}
        ariaLabel="Acciones centradas"
        items={[
          {
            id: 'primary',
            label: 'Acción principal',
            icon: <DollarSign size={16} />,
            onClick: vi.fn(),
          },
          {
            id: 'secondary',
            label: 'Acción secundaria',
            icon: <ShieldAlert size={16} />,
            onClick: vi.fn(),
          },
        ]}
      />,
    );

    fireEvent.click(screen.getByLabelText('Más acciones'));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
