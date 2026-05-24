import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Profile from '../Profile';

const mockUpdateProfile = vi.fn().mockResolvedValue(undefined);
const mockChangePassword = vi.fn().mockResolvedValue(undefined);

let currentUser = {
  id: 1,
  name: 'Administrador QA',
  email: 'admin@example.com',
  role: 'admin' as 'admin' | 'employee',
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

  it('shows only administrative account fields for admin users', () => {
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
    expect(screen.getByText('Este perfil corresponde a un usuario administrativo interno.')).toBeInTheDocument();
    expect(screen.queryByText(/clientes y socios/i)).not.toBeInTheDocument();
  });

  it('does not send customer contact fields when an employee updates the profile', async () => {
    currentUser = {
      id: 2,
      name: 'Empleado QA',
      email: 'employee@example.com',
      role: 'employee',
    };
    currentProfile = {
      name: currentUser.name,
      email: currentUser.email,
      phone: '3000001234',
    };

    renderProfile();

    fireEvent.change(screen.getByLabelText('Nombre completo'), { target: { value: 'Empleado Actualizado' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalledWith({
        name: 'Empleado Actualizado',
        email: currentUser.email,
      });
    });
  });
});
