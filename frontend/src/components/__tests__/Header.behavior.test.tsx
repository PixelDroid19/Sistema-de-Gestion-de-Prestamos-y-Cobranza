import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Header from '../Header';

let currentUser: {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'customer' | 'socio';
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

  it('includes the socio portal in global search for socio users', () => {
    currentUser = {
      id: 8,
      name: 'Socio QA',
      email: 'socio@example.com',
      role: 'socio',
      associateId: 9,
    };

    const setCurrentView = vi.fn();
    render(<Header setCurrentView={setCurrentView} />);

    const searchInput = screen.getByLabelText('Buscar módulo');
    fireEvent.focus(searchInput);
    fireEvent.change(searchInput, { target: { value: 'aport' } });
    fireEvent.keyDown(searchInput, { key: 'Enter' });

    expect(setCurrentView).toHaveBeenCalledWith('associates/9');
  });
});
