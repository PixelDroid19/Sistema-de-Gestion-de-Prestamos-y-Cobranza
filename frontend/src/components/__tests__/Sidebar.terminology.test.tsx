import { fireEvent, render, screen } from '@testing-library/react';
import Sidebar from '../Sidebar';

const mockLogout = vi.fn();

vi.mock('../../store/sessionStore', () => ({
  useSessionStore: () => ({ logout: mockLogout }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

describe('Sidebar canonical terminology parity', () => {
  it('renders canonical labels and avoids legacy synonyms', () => {
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
});
