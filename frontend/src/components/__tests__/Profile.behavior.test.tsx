import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Profile from '../Profile';

const mockUpdateProfile = vi.fn().mockResolvedValue(undefined);
const mockChangePassword = vi.fn().mockResolvedValue(undefined);

let currentUser = {
  id: 1,
  name: 'Administrador QA',
  email: 'admin@example.com',
  role: 'admin' as 'admin' | 'customer' | 'socio',
};
let currentProfile = {
  name: currentUser.name,
  email: currentUser.email,
  phone: '3000001234',
};

vi.mock('../../services/authService', () => ({
  useAuth: () => ({
    profile: currentProfile,
    updateProfile: { mutateAsync: mockUpdateProfile, isPending: false },
    changePassword: { mutateAsync: mockChangePassword, isPending: false },
  }),
}));

vi.mock('../../store/sessionStore', () => ({
  useSessionStore: () => ({
    user: currentUser,
  }),
}));

vi.mock('../../lib/toast', () => ({
  toast: {
    warning: vi.fn(),
    success: vi.fn(),
    apiErrorSafe: vi.fn(),
  },
}));

const renderProfile = () => render(<Profile />);

describe('Profile behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentProfile = {
      name: currentUser.name,
      email: currentUser.email,
      phone: '3000001234',
    };
  });

  it('shows operational guidance instead of a non-persisted phone field for admin users', () => {
    currentUser = {
      id: 1,
      name: 'Administrador QA',
      email: 'admin@example.com',
      role: 'admin',
    };
    currentProfile = {
      name: currentUser.name,
      email: currentUser.email,
      phone: '3000001234',
    };

    renderProfile();

    expect(screen.queryByLabelText('Teléfono')).not.toBeInTheDocument();
    expect(screen.getByText('Este perfil usa solo nombre y correo. El teléfono aplica para clientes y socios.')).toBeInTheDocument();
  });

  it('keeps the phone field for customer profiles', () => {
    currentUser = {
      id: 2,
      name: 'Cliente QA',
      email: 'customer@example.com',
      role: 'customer',
    };
    currentProfile = {
      name: currentUser.name,
      email: currentUser.email,
      phone: '3000001234',
    };

    renderProfile();

    expect(screen.getByLabelText('Teléfono')).toBeInTheDocument();
  });
});
