import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import EmployeeEditModal from '../EmployeeEditModal';

const { setAllDirectPermissions } = vi.hoisted(() => ({ setAllDirectPermissions: vi.fn().mockResolvedValue({}) }));

vi.mock('../../lib/confirmModal', () => ({
  confirm: vi.fn().mockResolvedValue(true),
  confirmDanger: vi.fn().mockResolvedValue(true),
}));

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
    permissions: [
      { permission: 'CREDITS_VIEW_ALL', module: 'CREDITOS' },
      { permission: 'CLIENTS_VIEW_ALL', module: 'CLIENTES' },
    ],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useUserPermissions: () => ({
    permissions: [
      { permission: 'CREDITS_VIEW_ALL', module: 'CREDITOS', source: 'direct' },
      { permission: 'CLIENTS_VIEW_ALL', module: 'CLIENTES', source: 'role' },
    ],
    isLoading: false,
    isError: false,
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
  useSetAllDirectPermissions: () => ({
    setAllDirectPermissions: {
      mutateAsync: setAllDirectPermissions,
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

  it('offers one confirmed action for all direct permissions while keeping module actions separate', async () => {
    const user = userEvent.setup();
    setAllDirectPermissions.mockClear();
    const { container } = render(<EmployeeEditModal employee={employee} onClose={vi.fn()} />);

    await user.click(screen.getByRole('tab', { name: 'Permisos' }));
    expect(screen.getByRole('button', { name: 'Conceder todos los permisos' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Revocar todos los permisos' })).toBeEnabled();
    expect(screen.getAllByRole('button', { name: 'Conceder módulo' })).toHaveLength(2);
    expect(container.querySelector('button button')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Conceder todos los permisos' }));
    await waitFor(() => expect(setAllDirectPermissions).toHaveBeenCalledWith({ userId: '42', action: 'grant_all' }));

    await user.click(screen.getByRole('button', { name: 'Revocar todos los permisos' }));
    await waitFor(() => expect(setAllDirectPermissions).toHaveBeenCalledWith({ userId: '42', action: 'revoke_all' }));
  });
});
