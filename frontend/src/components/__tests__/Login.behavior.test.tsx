import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import Login from '../Login';

const mockLogin = vi.fn();
const mockNavigate = vi.fn();
const mockToastApiErrorSafe = vi.fn();

let currentLocation: { state?: { from?: { pathname: string } } } = {};

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => currentLocation,
}));

vi.mock('../../services/authService', () => ({
  useAuth: () => ({
    login: (...args: unknown[]) => mockLogin(...args),
  }),
}));

vi.mock('../../lib/toast', () => ({
  toast: {
    apiErrorSafe: (...args: unknown[]) => mockToastApiErrorSafe(...args),
  },
}));

vi.mock('../../services/safeErrorMessages', () => ({
  getSafeErrorText: () => 'No se pudo iniciar sesión',
  extractStatusCode: (error: { statusCode?: number }) => error?.statusCode,
}));

describe('Login behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentLocation = {};
  });

  it('redirects customers to their default route when no pending route exists', async () => {
    mockLogin.mockResolvedValue({
      data: {
        user: {
          role: 'customer',
        },
      },
    });

    render(<Login />);

    fireEvent.change(screen.getByPlaceholderText('nombre@empresa.com'), {
      target: { value: 'qa.customer@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('Ingresa tu contraseña'), {
      target: { value: 'Admin1234' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/credits', { replace: true });
    });
  });

  it('redirects socios to their portal when no pending route exists', async () => {
    mockLogin.mockResolvedValue({
      data: {
        user: {
          role: 'socio',
          associateId: 12,
        },
      },
    });

    render(<Login />);

    fireEvent.change(screen.getByPlaceholderText('nombre@empresa.com'), {
      target: { value: 'qa.socio@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('Ingresa tu contraseña'), {
      target: { value: 'Admin1234' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/associates/12', { replace: true });
    });
  });

  it('preserves the originally requested route after login', async () => {
    currentLocation = {
      state: {
        from: {
          pathname: '/credits/77',
        },
      },
    };
    mockLogin.mockResolvedValue({
      data: {
        user: {
          role: 'customer',
        },
      },
    });

    render(<Login />);

    fireEvent.change(screen.getByPlaceholderText('nombre@empresa.com'), {
      target: { value: 'qa.customer@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('Ingresa tu contraseña'), {
      target: { value: 'Admin1234' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/credits/77', { replace: true });
    });
  });

  it('shows the safe login error text when credentials are rejected', async () => {
    mockLogin.mockRejectedValue({
      statusCode: 401,
      message: 'Please enter correct email/password',
    });

    render(<Login />);

    fireEvent.change(screen.getByPlaceholderText('nombre@empresa.com'), {
      target: { value: 'admin@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('Ingresa tu contraseña'), {
      target: { value: 'mal-password' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));

    await waitFor(() => {
      expect(screen.getByText('No se pudo iniciar sesión')).toBeInTheDocument();
    });

    expect(mockToastApiErrorSafe).not.toHaveBeenCalled();
  });
});
