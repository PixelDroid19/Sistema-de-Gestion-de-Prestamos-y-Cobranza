import type { ReactNode } from 'react';
import './FloatingActionDock.css';

/** Barra flotante compartida (p. ej. `NewCredit`, `CreditDetailPaymentActions`). */
export type FloatingActionDockLayout = 'new-credit' | 'actions';

type FloatingActionDockProps = {
  children: ReactNode;
  ariaLabel: string;
  layout: FloatingActionDockLayout;
  /** Used with `layout="actions"` to set the grid column count (1–3). */
  itemCount?: 1 | 2 | 3;
  className?: string;
  'data-tour'?: string;
};

/** Shared pill button sizing for docks (pair with `ActionButton` + `fullWidth`). */
export const floatingActionDockButtonClass = 'h-10 min-w-0 rounded-full px-3';

/** Shared circular icon button sizing (pair with `IconActionButton`). */
export const floatingActionDockIconButtonClass = 'h-10 w-10 rounded-full';

export function FloatingActionDock({
  children,
  ariaLabel,
  layout,
  itemCount = 3,
  className = '',
  'data-tour': dataTour,
}: FloatingActionDockProps) {
  return (
    <div
      className={[
        'floating-action-dock',
        `floating-action-dock--layout-${layout}`,
        className,
      ].filter(Boolean).join(' ')}
      data-tour={dataTour}
      data-count={layout === 'actions' ? itemCount : undefined}
      role="toolbar"
      aria-label={ariaLabel}
    >
      {children}
    </div>
  );
}
