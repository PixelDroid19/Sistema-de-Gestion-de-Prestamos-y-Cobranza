import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import App from '../../App';

const { mockToaster } = vi.hoisted(() => ({
  mockToaster: vi.fn(),
}));

const sessionState = {
  accessToken: 'access-token',
  refreshToken: null as string | null,
  user: { id: 4, role: 'socio' as 'admin' | 'employee' | 'customer' | 'socio' },
  hasHydrated: true,
  logout: vi.fn(),
};

vi.mock('../../api/client', () => ({
  restoreAccessToken: vi.fn(),
  apiClient: {
    get: vi.fn(),
  },
}));

vi.mock('../../store/sessionStore', () => ({
  useSessionStore: () => sessionState,
}));

vi.mock('../../lib/toast', () => ({
  Toaster: (props: unknown) => {
    mockToaster(props);
    return null;
  },
}));

vi.mock('../Sidebar', () => ({ default: () => <aside>Menú administrativo</aside> }));
vi.mock('../Header', () => ({ default: () => <header>Encabezado administrativo</header> }));
vi.mock('../Profile', () => ({ default: () => <main>Perfil administrativo</main> }));
vi.mock('../Login', () => ({ default: () => <main>Acceso</main> }));

const renderApp = (initialPath: string) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe('App administrative access', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionState.accessToken = 'access-token';
    sessionState.refreshToken = null;
    sessionState.user = { id: 4, role: 'socio' };
    sessionState.hasHydrated = true;
  });

  it('redirects stale socio sessions away from the administrative profile layout', async () => {
    renderApp('/profile');

    expect(await screen.findByText('Acceso')).toBeInTheDocument();
    expect(screen.queryByText('Perfil administrativo')).not.toBeInTheDocument();
    expect(screen.queryByText('Menú administrativo')).not.toBeInTheDocument();
  });

  it('preserves translated sentence casing in toast titles', () => {
    renderApp('/login');

    expect(mockToaster).toHaveBeenCalledWith(expect.objectContaining({
      options: expect.objectContaining({
        styles: expect.objectContaining({
          title: expect.stringContaining('normal-case!'),
        }),
      }),
    }));
  });
});
