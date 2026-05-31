import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import EmployeeEditModal from '../EmployeeEditModal';

vi.mock('../../services/userService', () => ({
  useUsers: () => ({
    updateUser: {
      mutateAsync: vi.fn(),
      isPending: false,
    },
  }),
}));

vi.mock('../../services/permissionsService', () => ({
  usePermissions: () => ({
    permissions: [],
    isLoading: false,
  }),
  useUserPermissions: () => ({
    permissions: [],
    isLoading: false,
    refetch: vi.fn(),
  }),
  useGrantBatchPermissions: () => ({
    grantBatchPermissions: {
      mutateAsync: vi.fn(),
      isPending: false,
    },
  }),
  useRevokePermission: () => ({
    revokePermission: {
      mutateAsync: vi.fn(),
      isPending: false,
    },
  }),
}));

vi.mock('../../lib/toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    apiErrorSafe: vi.fn(),
  },
}));

const employee = {
  id: 42,
  name: 'Operadora Demo',
  email: 'operadora@example.com',
  role: 'employee',
  isActive: true,
};

describe('EmployeeEditModal behavior', () => {
  it('moves initial keyboard focus into the dialog', () => {
    render(<EmployeeEditModal employee={employee} onClose={vi.fn()} />);

    expect(screen.getByRole('dialog', { name: 'Editar empleado' })).toHaveFocus();
  });

  it('keeps tab focus inside the dialog', async () => {
    const user = userEvent.setup();

    render(
      <>
        <button type="button">Fuera del modal</button>
        <EmployeeEditModal employee={employee} onClose={vi.fn()} />
      </>,
    );

    const dialog = screen.getByRole('dialog', { name: 'Editar empleado' });
    const closeButton = screen.getByRole('button', { name: 'Cerrar' });
    const emailInput = screen.getByLabelText('Correo');

    expect(dialog).toHaveFocus();

    await user.tab({ shift: true });
    expect(emailInput).toHaveFocus();

    await user.tab();
    expect(closeButton).toHaveFocus();
  });
});
