import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GuestRoute, ProtectedRoute } from '../ProtectedRoute';

const restoreAccessToken = vi.fn();

const sessionState = {
  accessToken: null as string | null,
  refreshToken: null as string | null,
  user: null as null | { id: number; role: 'admin' | 'customer' | 'socio'; associateId?: number },
  hasHydrated: false,
  logout: vi.fn(),
};

vi.mock('../../api/client', () => ({
  restoreAccessToken: () => restoreAccessToken(),
}));

vi.mock('../../store/sessionStore', () => ({
  useSessionStore: () => sessionState,
}));

const renderWithProviders = (ui: React.ReactNode, initialEntries = ['/private']) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        {ui}
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe('ProtectedRoute behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionState.accessToken = null;
    sessionState.refreshToken = null;
    sessionState.user = null;
    sessionState.hasHydrated = false;
  });

  it('waits for persisted session hydration before redirecting', () => {
    sessionState.refreshToken = 'refresh-token';

    renderWithProviders(
      <Routes>
        <Route
          path="/private"
          element={(
            <ProtectedRoute>
              <div>Zona privada</div>
            </ProtectedRoute>
          )}
        />
        <Route path="/login" element={<div>Acceso</div>} />
      </Routes>,
    );

    expect(screen.getByText('Restaurando sesión...')).toBeInTheDocument();
    expect(screen.queryByText('Acceso')).not.toBeInTheDocument();
    expect(restoreAccessToken).not.toHaveBeenCalled();
  });

  it('redirects to login after hydration if there is no valid session', () => {
    sessionState.hasHydrated = true;

    renderWithProviders(
      <Routes>
        <Route
          path="/private"
          element={(
            <ProtectedRoute>
              <div>Zona privada</div>
            </ProtectedRoute>
          )}
        />
        <Route path="/login" element={<div>Acceso</div>} />
      </Routes>,
    );

    expect(screen.getByText('Acceso')).toBeInTheDocument();
  });

  it('redirects authenticated users away from the login view', () => {
    sessionState.hasHydrated = true;
    sessionState.accessToken = 'access-token';
    sessionState.user = { id: 1, role: 'admin' };

    renderWithProviders(
      <Routes>
        <Route
          path="/login"
          element={(
            <GuestRoute>
              <div>Acceso</div>
            </GuestRoute>
          )}
        />
        <Route path="/dashboard" element={<div>Inicio admin</div>} />
      </Routes>,
      ['/login'],
    );

    expect(screen.getByText('Inicio admin')).toBeInTheDocument();
  });
});
