import type { ReactNode } from 'react';
import { TABLE_CELL_ACTIONS_CLASS } from './tableActionStyles';

type TableActionsHeaderProps = {
  children: ReactNode;
  className?: string;
};

type TableActionsCellProps = {
  children: ReactNode;
  className?: string;
};

export function TableActionsHeader({ children, className = '' }: TableActionsHeaderProps) {
  return (
    <th className={`${TABLE_CELL_ACTIONS_CLASS} ${className}`.trim()}>
      {children}
    </th>
  );
}

export function TableActionsCell({ children, className = '' }: TableActionsCellProps) {
  return (
    <td className={`${TABLE_CELL_ACTIONS_CLASS} ${className}`.trim()}>
      {children}
    </td>
  );
}
