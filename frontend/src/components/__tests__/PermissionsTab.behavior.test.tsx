import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import PermissionsTab from '../PermissionsTab';

vi.mock('../../services/permissionsService', () => ({
  usePermissions: () => ({
    permissions: [
      {
        permission: 'READ_CREDITOS',
        name: 'READ_CREDITOS',
        module: 'creditos',
        description: 'Consultar créditos',
      },
      {
        permission: 'READ_AUDITS',
        name: 'READ_AUDITS',
        module: 'AUDITORÍA',
        description: 'Consultar auditoría',
      },
      {
        permission: 'READ_USERS',
        name: 'READ_USERS',
        module: 'USUARIOS',
      },
    ],
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

vi.mock('../../services/userService', () => ({
  useUsers: () => ({
    data: {
      data: {
        users: [
          { id: 1, name: 'Empleada Demo', email: 'demo@example.com', role: 'employee' },
        ],
      },
    },
    isLoading: false,
  }),
}));

vi.mock('../../lib/toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    apiErrorSafe: vi.fn(),
  },
}));

vi.mock('../../i18n', () => ({
  useTranslation: () => ({
    locale: 'es',
    setLocale: () => {},
    t: (key: string) => key,
  }),
}));

describe('PermissionsTab behavior', () => {
  it('renders backend module keys with operator-friendly labels', () => {
    render(<PermissionsTab />);

    fireEvent.click(screen.getByRole('button', { name: /Catálogo de permisos/i }));

    expect(screen.getByRole('button', { name: /Créditos\s*1 permisos/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Auditoría\s*1 permisos/i })).toBeInTheDocument();
    expect(screen.queryByText('CREDITOS')).not.toBeInTheDocument();
  });

  it('uses the shared i18n fallback for permissions without descriptions', () => {
    render(<PermissionsTab />);

    fireEvent.click(screen.getByRole('button', { name: /Catálogo de permisos/i }));
    fireEvent.click(screen.getByRole('button', { name: /Usuarios\s*1 permisos/i }));

    expect(screen.queryByText('Sin descripción')).not.toBeInTheDocument();
    expect(screen.getByText('settings.employees.modal.permissions.noDescription')).toBeInTheDocument();
  });
});
