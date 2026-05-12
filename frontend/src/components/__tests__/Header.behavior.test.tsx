import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Header from '../Header';

let currentUser: {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'employee';
  associateId: number | null;
} = {
  id: 1,
  name: 'Administrador QA',
  email: 'admin@example.com',
  role: 'admin' as const,
  associateId: null,
};

vi.mock('../../store/sessionStore', () => ({
  useSessionStore: () => ({
    user: currentUser,
  }),
}));

let currentPermissions: Array<{ permission: string; name?: string }> = [];

vi.mock('../../services/permissionsService', () => ({
  useMyPermissions: () => ({
    permissions: currentPermissions,
    isLoading: false,
  }),
}));

vi.mock('../../services/notificationService', () => ({
  useUnreadNotificationsCount: () => ({
    unreadCount: 2,
    isLoading: false,
  }),
}));

describe('Header behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser = {
      id: 1,
      name: 'Administrador QA',
      email: 'admin@example.com',
      role: 'admin' as const,
      associateId: null,
    };
    currentPermissions = [];
  });

  it('routes to the first matching module from global search on Enter', () => {
    const setCurrentView = vi.fn();
    render(<Header setCurrentView={setCurrentView} />);

    const searchInput = screen.getByLabelText('Buscar módulo');
    fireEvent.focus(searchInput);
    fireEvent.change(searchInput, { target: { value: 'auditoría' } });
    fireEvent.keyDown(searchInput, { key: 'Enter' });

    expect(setCurrentView).toHaveBeenCalledWith('audit-log');
  });

  it('includes only permissioned modules in global search for employee users', () => {
    currentUser = {
      id: 8,
      name: 'Empleado QA',
      email: 'employee@example.com',
      role: 'employee',
      associateId: null,
    };
    currentPermissions = [{ permission: 'SOCIOS_VIEW_ALL' }];

    const setCurrentView = vi.fn();
    render(<Header setCurrentView={setCurrentView} />);

    const searchInput = screen.getByLabelText('Buscar módulo');
    fireEvent.focus(searchInput);
    fireEvent.change(searchInput, { target: { value: 'aport' } });
    fireEvent.keyDown(searchInput, { key: 'Enter' });

    expect(setCurrentView).toHaveBeenCalledWith('associates');
  });
});
