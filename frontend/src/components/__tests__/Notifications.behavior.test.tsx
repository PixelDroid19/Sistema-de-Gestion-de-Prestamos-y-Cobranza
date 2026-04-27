import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Notifications from '../Notifications';

const mockNavigate = vi.fn();
const mockMarkAsRead = vi.fn().mockResolvedValue(undefined);
const mockMarkAllAsRead = vi.fn().mockResolvedValue(undefined);
const mockClearNotifications = vi.fn().mockResolvedValue(undefined);
const mockConfirm = vi.fn().mockResolvedValue(true);

const notifications = [
  {
    id: 71,
    title: 'Pago registrado',
    message: 'Pago registrado en el crédito #5 por $180000.',
    createdAt: '2026-04-26T20:00:00.000Z',
    read: false,
    destination: '/credits/5',
  },
  {
    id: 72,
    title: 'Aviso general',
    message: 'Sin origen navegable.',
    createdAt: '2026-04-26T21:00:00.000Z',
    read: true,
    destination: null,
  },
];

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../services/notificationService', () => ({
  useNotifications: () => ({
    notifications,
    isLoading: false,
    isError: false,
    error: null,
    markAsRead: { mutateAsync: mockMarkAsRead, isPending: false },
    markAllAsRead: { mutateAsync: mockMarkAllAsRead, isPending: false },
    clearNotifications: { mutateAsync: mockClearNotifications, isPending: false },
  }),
}));

vi.mock('../../lib/confirmModal', () => ({
  confirm: (...args: unknown[]) => mockConfirm(...args),
}));

const mockToastSuccess = vi.fn();
const mockToastApiErrorSafe = vi.fn();

vi.mock('../../lib/toast', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    apiErrorSafe: (...args: unknown[]) => mockToastApiErrorSafe(...args),
  },
}));

const renderNotifications = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <Notifications />
    </QueryClientProvider>,
  );
};

describe('Notifications behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfirm.mockResolvedValue(true);
  });

  it('opens the linked credit and marks the notification as read', async () => {
    renderNotifications();

    fireEvent.click(screen.getByRole('button', { name: /pago registrado/i }));

    await waitFor(() => {
      expect(mockMarkAsRead).toHaveBeenCalledWith(71);
      expect(mockNavigate).toHaveBeenCalledWith('/credits/5');
    });
  });

  it('marks all visible notifications as read', async () => {
    renderNotifications();

    fireEvent.click(screen.getByRole('button', { name: /marcar leídas/i }));

    await waitFor(() => {
      expect(mockMarkAllAsRead).toHaveBeenCalledOnce();
      expect(mockToastSuccess).toHaveBeenCalled();
    });
  });

  it('clears notifications after confirmation', async () => {
    renderNotifications();

    fireEvent.click(screen.getByRole('button', { name: /^limpiar$/i }));

    await waitFor(() => {
      expect(mockConfirm).toHaveBeenCalledOnce();
      expect(mockClearNotifications).toHaveBeenCalledOnce();
    });
  });
});
