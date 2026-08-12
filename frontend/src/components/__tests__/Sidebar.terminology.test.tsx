import { act, fireEvent, render, screen, within } from '@testing-library/react';
import Sidebar from '../Sidebar';

const mockClearSession = vi.fn();
const mockRequestLogout = vi.fn(() => Promise.resolve());
const mockNavigate = vi.fn();
const mockClearQueryCache = vi.fn();
type SidebarTestUser = {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'employee' | 'customer' | 'socio';
  associateId: number | null;
};

let currentUser: SidebarTestUser = {
  id: 1,
  name: 'Administrador QA',
  email: 'admin@example.com',
  role: 'admin',
  associateId: null,
};

vi.mock('../../store/sessionStore', () => ({
  useSessionStore: () => ({
    accessToken: 'access-token-before-clear',
    refreshToken: 'refresh-token-before-clear',
    logout: mockClearSession,
    user: currentUser,
  }),
}));

vi.mock('../../services/authService', () => ({
  useAuth: () => ({
    logout: mockRequestLogout,
  }),
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    clear: mockClearQueryCache,
  }),
}));

let currentPermissions: Array<{ permission: string }> = [];

const setViewportMatch = (matches: boolean) => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
};

vi.mock('../../services/permissionsService', () => ({
  useMyPermissions: () => ({
    permissions: currentPermissions,
    isLoading: false,
  }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

describe('Sidebar canonical terminology parity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setViewportMatch(true);
    currentUser = {
      id: 1,
      name: 'Administrador QA',
      email: 'admin@example.com',
      role: 'admin',
      associateId: null,
    };
    currentPermissions = [];
  });

  it('renders canonical labels and avoids outdated synonyms', () => {
    const setCurrentView = vi.fn();
    const setIsCollapsed = vi.fn();
    const setIsMobileOpen = vi.fn();

    render(
      <Sidebar
        currentView="dashboard"
        setCurrentView={setCurrentView}
        isCollapsed={false}
        setIsCollapsed={setIsCollapsed}
        isMobileOpen={false}
        setIsMobileOpen={setIsMobileOpen}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Clientes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Créditos' }));
    fireEvent.click(screen.getByRole('button', { name: 'Socios' }));

    expect(setCurrentView).toHaveBeenNthCalledWith(1, 'customers');
    expect(setCurrentView).toHaveBeenNthCalledWith(2, 'credits');
    expect(setCurrentView).toHaveBeenNthCalledWith(3, 'associates');

    expect(screen.getByRole('button', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lista de clientes' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nuevo cliente' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Créditos vigentes' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nuevo crédito' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reportes' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pagos y cobranza' })).toBeInTheDocument();

    expect(screen.queryByRole('button', { name: 'Directorio' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Directorio de clientes' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Alta de cliente' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cartera activa' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Originación' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nuevo Cliente' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Préstamos Activos' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Historial de Pagos' })).not.toBeInTheDocument();
  });

  it('shows only permissioned credits navigation to employees', () => {
    currentUser = {
      id: 2,
      name: 'Empleado QA',
      email: 'employee@example.com',
      role: 'employee',
      associateId: null,
    };
    currentPermissions = [{ permission: 'CREDITS_VIEW_ALL' }];

    const setCurrentView = vi.fn();
    const setIsCollapsed = vi.fn();
    const setIsMobileOpen = vi.fn();

    render(
      <Sidebar
        currentView="credits"
        setCurrentView={setCurrentView}
        isCollapsed={false}
        setIsCollapsed={setIsCollapsed}
        isMobileOpen={false}
        setIsMobileOpen={setIsMobileOpen}
      />,
    );

    expect(screen.getByRole('button', { name: 'Créditos vigentes' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cálculo de Crédito' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nuevo crédito' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reportes' })).not.toBeInTheDocument();
  });

  it('exposes a direct expense-registration entry to users with finance access', () => {
    const setCurrentView = vi.fn();

    render(
      <Sidebar
        currentView="dashboard"
        setCurrentView={setCurrentView}
        isCollapsed={false}
        setIsCollapsed={vi.fn()}
        isMobileOpen={false}
        setIsMobileOpen={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Créditos' }));
    fireEvent.click(screen.getByRole('button', { name: 'Registrar gasto' }));

    expect(setCurrentView).toHaveBeenLastCalledWith('reports?view=expenses');
  });

  it('keeps account actions visible while only the navigation list scrolls', () => {
    const setCurrentView = vi.fn();
    const setIsCollapsed = vi.fn();
    const setIsMobileOpen = vi.fn();

    const { container } = render(
      <Sidebar
        currentView="dashboard"
        setCurrentView={setCurrentView}
        isCollapsed={false}
        setIsCollapsed={setIsCollapsed}
        isMobileOpen={false}
        setIsMobileOpen={setIsMobileOpen}
      />,
    );

    expect(container.querySelector('aside')).toHaveClass('overflow-hidden');
    expect(container.querySelector('aside')).toHaveClass('h-full');
    expect(container.querySelector('nav')).toHaveClass('overflow-y-auto');
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument();
  });

  it('removes the closed mobile drawer from the accessibility tree', () => {
    setViewportMatch(false);
    const setCurrentView = vi.fn();
    const setIsCollapsed = vi.fn();
    const setIsMobileOpen = vi.fn();

    const { container } = render(
      <Sidebar
        currentView="dashboard"
        setCurrentView={setCurrentView}
        isCollapsed={false}
        setIsCollapsed={setIsCollapsed}
        isMobileOpen={false}
        setIsMobileOpen={setIsMobileOpen}
      />,
    );

    const aside = container.querySelector('aside');

    expect(aside).toHaveAttribute('aria-hidden', 'true');
    expect(aside).toHaveAttribute('inert');
    expect(aside).toHaveStyle({ transform: 'translateX(-100%)' });
    expect(screen.queryByRole('button', { name: 'Cerrar sesión' })).not.toBeInTheDocument();
  });

  it('keeps the open mobile drawer available to assistive navigation', () => {
    setViewportMatch(false);
    const setCurrentView = vi.fn();
    const setIsCollapsed = vi.fn();
    const setIsMobileOpen = vi.fn();

    const { container } = render(
      <Sidebar
        currentView="dashboard"
        setCurrentView={setCurrentView}
        isCollapsed={false}
        setIsCollapsed={setIsCollapsed}
        isMobileOpen={true}
        setIsMobileOpen={setIsMobileOpen}
      />,
    );

    const aside = container.querySelector('aside');

    expect(aside).not.toHaveAttribute('aria-hidden');
    expect(aside).not.toHaveAttribute('inert');
    expect(aside).toHaveStyle({ transform: 'translateX(0)' });
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument();
  });

  it('keeps administrative module links in the scrollable navigation area', () => {
    const setCurrentView = vi.fn();
    const setIsCollapsed = vi.fn();
    const setIsMobileOpen = vi.fn();

    const { container } = render(
      <Sidebar
        currentView="settings"
        setCurrentView={setCurrentView}
        isCollapsed={false}
        setIsCollapsed={setIsCollapsed}
        isMobileOpen={false}
        setIsMobileOpen={setIsMobileOpen}
      />,
    );

    const navigation = container.querySelector('nav');
    expect(navigation).not.toBeNull();
    expect(within(navigation as HTMLElement).getByRole('button', { name: 'Auditoría' })).toBeInTheDocument();
    expect(within(navigation as HTMLElement).getByRole('button', { name: 'Configuración' })).toBeInTheDocument();
  });

  it('announces expandable section state in the navigation', () => {
    const setCurrentView = vi.fn();
    const setIsCollapsed = vi.fn();
    const setIsMobileOpen = vi.fn();

    render(
      <Sidebar
        currentView="credits"
        setCurrentView={setCurrentView}
        isCollapsed={false}
        setIsCollapsed={setIsCollapsed}
        isMobileOpen={false}
        setIsMobileOpen={setIsMobileOpen}
      />,
    );

    expect(screen.getByRole('button', { name: 'Clientes' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: 'Créditos' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('closes inactive section menus when the active module changes', () => {
    const setCurrentView = vi.fn();
    const setIsCollapsed = vi.fn();
    const setIsMobileOpen = vi.fn();

    const { rerender } = render(
      <Sidebar
        currentView="associates"
        setCurrentView={setCurrentView}
        isCollapsed={false}
        setIsCollapsed={setIsCollapsed}
        isMobileOpen={false}
        setIsMobileOpen={setIsMobileOpen}
      />,
    );

    expect(screen.getByRole('button', { name: 'Gestión de socios' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pagos e intereses' })).toBeInTheDocument();

    rerender(
      <Sidebar
        currentView="credits"
        setCurrentView={setCurrentView}
        isCollapsed={false}
        setIsCollapsed={setIsCollapsed}
        isMobileOpen={false}
        setIsMobileOpen={setIsMobileOpen}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Gestión de socios' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pagos e intereses' })).not.toBeInTheDocument();
  });

  it('marks only payments and interest tracking as active on its route', () => {
    const setCurrentView = vi.fn();
    const setIsCollapsed = vi.fn();
    const setIsMobileOpen = vi.fn();

    render(
      <Sidebar
        currentView="associates/tracking"
        setCurrentView={setCurrentView}
        isCollapsed={false}
        setIsCollapsed={setIsCollapsed}
        isMobileOpen={false}
        setIsMobileOpen={setIsMobileOpen}
      />,
    );

    expect(screen.getByRole('button', { name: 'Gestión de socios' })).toHaveAttribute('data-active', 'false');
    expect(screen.getByRole('button', { name: 'Pagos e intereses' })).toHaveAttribute('data-active', 'true');
  });

  it('clears the local session and redirects immediately on logout', async () => {
    const setCurrentView = vi.fn();
    const setIsCollapsed = vi.fn();
    const setIsMobileOpen = vi.fn();

    render(
      <Sidebar
        currentView="dashboard"
        setCurrentView={setCurrentView}
        isCollapsed={false}
        setIsCollapsed={setIsCollapsed}
        isMobileOpen={false}
        setIsMobileOpen={setIsMobileOpen}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    });

    expect(mockRequestLogout).toHaveBeenCalledWith({
      accessToken: 'access-token-before-clear',
      refreshToken: 'refresh-token-before-clear',
      user: currentUser,
    });
    expect(mockClearSession).toHaveBeenCalledTimes(1);
    expect(mockClearQueryCache).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true });
    expect(setIsMobileOpen).toHaveBeenCalledWith(false);
  });
});
