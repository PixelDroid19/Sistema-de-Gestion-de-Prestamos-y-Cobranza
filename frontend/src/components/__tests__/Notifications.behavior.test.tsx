import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Notifications from '../Notifications';

const mockNavigate = vi.fn();
const mockMarkAsRead = vi.fn().mockResolvedValue(undefined);
const mockMarkAllAsRead = vi.fn().mockResolvedValue(undefined);
const mockClearNotifications = vi.fn().mockResolvedValue(undefined);
const mockConfirm = vi.fn().mockResolvedValue(true);

let notifications = [
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
  associateId: null as number | null,
};

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
  resolveNotificationDestinationForUser: (notification: any, user: any) => {
    if (notification?.destination?.startsWith('/customers/')) {
      return user?.role === 'admin' ? notification.destination : null;
    }
    return notification?.destination ?? null;
  },
}));

vi.mock('../../store/sessionStore', () => ({
  useSessionStore: () => ({
    user: currentUser,
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
    notifications = [
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
    currentUser = {
      id: 1,
      name: 'Administrador QA',
      email: 'admin@example.com',
      role: 'admin',
      associateId: null,
    };
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

  it('hides restricted notification destinations for non-admin users', () => {
    currentUser = {
      id: 9,
      name: 'Cliente QA',
      email: 'customer@example.com',
      role: 'customer',
      associateId: null,
    };

    notifications = [{
      ...notifications[0],
      destination: '/customers/5',
      title: 'Cliente actualizado',
    }];

    renderNotifications();

    expect(screen.queryByText('Abrir')).not.toBeInTheDocument();
  });
});
