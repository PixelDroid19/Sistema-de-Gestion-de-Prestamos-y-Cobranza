import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Header from '../Header';

const currentUser = {
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
});
