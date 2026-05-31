import { render, screen, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PermissionsTab from '../PermissionsTab';

let mockLocale = 'es';

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
  getCurrentLocale: () => mockLocale,
  interpolateTemplate: (template: string, vars?: Record<string, string | number>) => (
    Object.entries(vars ?? {}).reduce(
      (current, [name, value]) => current.replace(new RegExp(`\\{${name}\\}`, 'g'), String(value)),
      template,
    )
  ),
  useTranslation: () => ({
    locale: mockLocale,
    setLocale: () => {},
    t: (key: string, vars?: Record<string, string | number>) => {
      const dictionaries: Record<string, Record<string, string>> = {
        es: {
          'settings.employees.modal.permissions.viewsAria': 'Vistas de permisos',
          'settings.employees.modal.permissions.catalogTab': 'Catálogo de permisos',
          'settings.employees.modal.permissions.userTab': 'Gestión por usuario',
          'settings.employees.modal.permissions.permissionCount': '{count} permisos',
          'settings.employees.modal.permissions.userLabel': 'Usuario',
          'settings.employees.modal.permissions.userPlaceholder': 'Seleccione un usuario',
          'settings.employees.modal.permissions.moduleLabel': 'Módulo',
          'settings.employees.modal.permissions.moduleAll': 'Todos los módulos',
          'settings.employees.modal.permissions.refresh': 'Actualizar permisos',
          'settings.employees.modal.permissions.noDescription': 'Sin descripción',
          'settings.employees.modal.permissions.actions.view': 'Consultar',
          'settings.employees.modal.permissions.actions.manage': 'Gestionar',
        },
        en: {
          'settings.employees.modal.permissions.viewsAria': 'Permission views',
          'settings.employees.modal.permissions.catalogTab': 'Permission catalog',
          'settings.employees.modal.permissions.userTab': 'User management',
          'settings.employees.modal.permissions.permissionCount': '{count} permissions',
          'settings.employees.modal.permissions.userLabel': 'User',
          'settings.employees.modal.permissions.userPlaceholder': 'Select a user',
          'settings.employees.modal.permissions.moduleLabel': 'Module',
          'settings.employees.modal.permissions.moduleAll': 'All modules',
          'settings.employees.modal.permissions.refresh': 'Refresh permissions',
          'settings.employees.modal.permissions.noDescription': 'No description',
          'settings.employees.modal.permissions.actions.view': 'View',
          'settings.employees.modal.permissions.actions.manage': 'Manage',
        },
      };
      const template = dictionaries[mockLocale][key] ?? key;
      return Object.entries(vars ?? {}).reduce(
        (current, [name, value]) => current.replace(new RegExp(`\\{${name}\\}`, 'g'), String(value)),
        template,
      );
    },
  }),
}));

describe('PermissionsTab behavior', () => {
  beforeEach(() => {
    mockLocale = 'es';
  });

  it('renders backend module keys with operator-friendly labels', () => {
    render(<PermissionsTab />);

    fireEvent.click(screen.getByRole('tab', { name: /Catálogo de permisos/i }));
    fireEvent.click(screen.getByRole('button', { name: /Créditos\s*1 permisos/i }));

    expect(screen.getByRole('button', { name: /Créditos\s*1 permisos/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Auditoría\s*1 permisos/i })).toBeInTheDocument();
    expect(screen.queryByText('CREDITOS')).not.toBeInTheDocument();
    expect(screen.getByText('Consultar créditos')).toBeInTheDocument();
    expect(screen.queryByText('READ_CREDITOS')).not.toBeInTheDocument();
  });

  it('uses operator-friendly permission labels when descriptions are missing', () => {
    render(<PermissionsTab />);

    fireEvent.click(screen.getByRole('tab', { name: /Catálogo de permisos/i }));
    fireEvent.click(screen.getByRole('button', { name: /Usuarios\s*1 permisos/i }));

    expect(screen.getByText('Consultar usuarios')).toBeInTheDocument();
    expect(screen.queryByText('READ_USERS')).not.toBeInTheDocument();
  });

  it('uses translated labels for permission management controls', () => {
    mockLocale = 'en';

    render(<PermissionsTab />);

    expect(screen.getByRole('tab', { name: /Permission catalog/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /User management/i })).toBeInTheDocument();
    expect(screen.getByLabelText('User')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Select a user' })).toBeInTheDocument();
    expect(screen.getByLabelText('Module')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'All modules' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh permissions' })).toBeInTheDocument();
    expect(screen.queryByText('Seleccione un usuario')).not.toBeInTheDocument();
  });
});
