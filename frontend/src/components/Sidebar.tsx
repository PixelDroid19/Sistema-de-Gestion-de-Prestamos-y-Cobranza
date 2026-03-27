import React, { useState } from 'react';
import { LayoutDashboard, Users, Briefcase, UserPlus, CreditCard, DollarSign, BarChart, Settings, LogOut, ChevronDown, ChevronRight } from 'lucide-react';
import { useSessionStore } from '../store/sessionStore';
import { useNavigate } from 'react-router-dom';

export default function Sidebar({ currentView, setCurrentView }: { currentView: string, setCurrentView: (v: string) => void }) {
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({
    clientes: true,
    creditos: true,
    socios: true,
  });

  const isCustomersView = currentView === 'customers' || currentView.startsWith('customers/');

  const { logout } = useSessionStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const toggleMenu = (menu: string) => {
    setOpenMenus(prev => ({ ...prev, [menu]: !prev[menu] }));
  };

  return (
    <aside className="w-64 bg-bg-surface flex flex-col py-6 border-r border-border-subtle shrink-0 overflow-y-auto">
      <div className="mb-8 px-6 cursor-pointer flex items-center gap-3" onClick={() => setCurrentView('dashboard')}>
        <div className="w-10 h-10 bg-text-primary rounded-xl flex items-center justify-center text-bg-base font-bold text-xl shrink-0">
          U
        </div>
        <span className="font-bold text-lg tracking-tight text-text-primary">LendingSys</span>
      </div>
      
      <nav className="flex-1 flex flex-col gap-2 w-full px-4">
        <NavItem 
          icon={<LayoutDashboard size={20} />} 
          active={currentView === 'dashboard'} 
          onClick={() => setCurrentView('dashboard')} 
          title="Dashboard" 
        />

        {/* Clientes */}
        <div className="mt-2">
          <div className={`flex items-center rounded-xl transition-colors ${isCustomersView ? 'bg-hover-bg text-text-primary' : 'text-text-secondary hover:text-text-primary hover:bg-hover-bg'}`}>
            <button
              onClick={() => setCurrentView('customers')}
              className="flex flex-1 items-center gap-3 p-3 text-left"
            >
              <Users size={20} />
              <span className="font-medium text-sm">Clientes</span>
            </button>
            <button
              onClick={() => toggleMenu('clientes')}
              className="p-3"
              aria-label={openMenus['clientes'] ? 'Ocultar submenu de clientes' : 'Mostrar submenu de clientes'}
            >
              {openMenus['clientes'] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
          </div>
          
          {openMenus['clientes'] && (
            <div className="flex flex-col gap-1 mt-1 ml-4 pl-4 border-l border-border-strong">
              <SubNavItem 
                active={isCustomersView} 
                onClick={() => setCurrentView('customers')} 
                title="Ver clientes" 
              />
              <SubNavItem 
                active={currentView === 'customers-new'} 
                onClick={() => setCurrentView('customers-new')} 
                title="Nuevo cliente" 
              />
            </div>
          )}
        </div>

        {/* Créditos */}
        <div className="mt-2">
          <button 
            onClick={() => toggleMenu('creditos')}
            className="w-full flex items-center justify-between p-3 rounded-xl text-text-secondary hover:text-text-primary hover:bg-hover-bg transition-colors"
          >
            <div className="flex items-center gap-3">
              <CreditCard size={20} />
              <span className="font-medium text-sm">Créditos</span>
            </div>
            {openMenus['creditos'] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
          
          {openMenus['creditos'] && (
            <div className="flex flex-col gap-1 mt-1 ml-4 pl-4 border-l border-border-strong">
              <SubNavItem 
                active={currentView === 'credits'} 
                onClick={() => setCurrentView('credits')} 
                title="Ver créditos" 
              />
              <SubNavItem 
                active={currentView === 'credits-new'} 
                onClick={() => setCurrentView('credits-new')} 
                title="Nuevo crédito" 
              />
              <SubNavItem 
                active={currentView === 'reports'} 
                onClick={() => setCurrentView('reports')} 
                title="Reportes" 
              />
            </div>
          )}
        </div>

        {/* Socios */}
        <div className="mt-2">
          <button 
            onClick={() => toggleMenu('socios')}
            className="w-full flex items-center justify-between p-3 rounded-xl text-text-secondary hover:text-text-primary hover:bg-hover-bg transition-colors"
          >
            <div className="flex items-center gap-3">
              <UserPlus size={20} />
              <span className="font-medium text-sm">Socios</span>
            </div>
            {openMenus['socios'] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
          
          {openMenus['socios'] && (
            <div className="flex flex-col gap-1 mt-1 ml-4 pl-4 border-l border-border-strong">
              <SubNavItem 
                active={currentView === 'associates'} 
                onClick={() => setCurrentView('associates')} 
                title="Ver socios" 
              />
            </div>
          )}
        </div>

        {/* Pagos */}
        <div className="mt-2">
          <NavItem 
            icon={<DollarSign size={20} />} 
            active={currentView === 'payouts'} 
            onClick={() => setCurrentView('payouts')} 
            title="Detalles de Pagos" 
          />
        </div>

        {/* Agentes */}
        <div className="mt-2">
          <NavItem 
            icon={<Briefcase size={20} />} 
            active={currentView === 'agents'} 
            onClick={() => setCurrentView('agents')} 
            title="Agentes" 
          />
        </div>

      </nav>

      <div className="flex flex-col gap-2 w-full px-4 mt-auto pt-6">
        <NavItem icon={<Settings size={20} />} active={currentView === 'settings'} onClick={() => setCurrentView('settings')} title="Configuración" />
        <NavItem icon={<LogOut size={20} />} onClick={handleLogout} title="Cerrar Sesión" />
      </div>
    </aside>
  );
}

function NavItem({ icon, active, onClick, title }: { icon: React.ReactNode; active?: boolean; onClick?: () => void; title: string }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors ${active ? 'bg-hover-bg text-text-primary' : 'text-text-secondary hover:text-text-primary hover:bg-hover-bg'}`}
    >
      {icon}
      <span className="font-medium text-sm">{title}</span>
    </button>
  );
}

function SubNavItem({ active, onClick, title }: { active?: boolean; onClick?: () => void; title: string }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full text-left py-2 px-3 rounded-lg transition-colors text-sm ${active ? 'bg-hover-bg text-text-primary font-medium' : 'text-text-secondary hover:text-text-primary hover:bg-hover-bg'}`}
    >
      {title}
    </button>
  );
}
