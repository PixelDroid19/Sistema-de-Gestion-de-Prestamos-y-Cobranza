import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Users, UserPlus, CreditCard, DollarSign, Settings, LogOut, ChevronDown, ClipboardList, X, PanelLeftClose, PanelLeftOpen, FlaskConical, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSessionStore } from '../store/sessionStore';
import { tTerm } from '../i18n/terminology';
import { getDefaultRouteForUser } from '../constants/appAccess';
import { APP_BRAND } from '../constants/appShell';
import { useAuth } from '../services/authService';

export default function Sidebar({ 
  currentView, 
  setCurrentView,
  isCollapsed,
  setIsCollapsed,
  isMobileOpen,
  setIsMobileOpen
}: { 
  currentView: string, 
  setCurrentView: (v: string) => void,
  isCollapsed: boolean,
  setIsCollapsed: (v: boolean) => void,
  isMobileOpen: boolean,
  setIsMobileOpen: (v: boolean) => void
}) {
  const navigate = useNavigate();
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({
    clientes: false,
    creditos: false,
    socios: false,
    formulas: false,
  });
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const isCustomersView = currentView === 'customers' || currentView.startsWith('customers/');
  const isCreditsView = currentView.startsWith('credit') || currentView === 'reports' || currentView === 'simulator';
  const isAssociatesView = currentView.startsWith('associate');
  const { user } = useSessionStore();
  const { logout: requestLogout } = useAuth();
  const resolvedRole = user?.role ?? 'admin';
  const isAdmin = resolvedRole === 'admin';
  const isCustomer = resolvedRole === 'customer';
  const isSocio = resolvedRole === 'socio';
  const homeView = getDefaultRouteForUser(user ?? { role: resolvedRole, associateId: undefined }).replace(/^\//u, '');
  const associatesHomeView = isSocio && Number.isFinite(Number(user?.associateId))
    ? `associates/${Number(user?.associateId)}`
    : 'associates';
  
  // Ocultar submenús al colapsar el sidebar en escritorio
  useEffect(() => {
    if (isCollapsed) {
       setOpenMenus({ clientes: false, creditos: false, socios: false, formulas: false });
    }
  }, [isCollapsed]);

  const handleSectionClick = (key: 'clientes' | 'creditos' | 'socios' | 'formulas', nextView: string, isSectionActive: boolean) => {
    if (isCollapsed) {
      setIsCollapsed(false);
    }
    const shouldToggleOnly = isSectionActive && currentView === nextView;
    setOpenMenus(prev => ({ ...prev, [key]: shouldToggleOnly ? !prev[key] : true }));

    if (!shouldToggleOnly) {
      setCurrentView(nextView);
    }
  };

  const handleLogout = async () => {
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);
    try {
      await requestLogout();
    } finally {
      setIsMobileOpen(false);
      navigate('/login', { replace: true });
      setIsLoggingOut(false);
    }
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden animate-in fade-in"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside className={`
        fixed md:static inset-y-0 left-0 z-50
        bg-bg-surface flex flex-col py-6 border-r border-border-subtle shrink-0 overflow-y-auto
        transition-all duration-300 ease-in-out shadow-2xl md:shadow-none
        ${isCollapsed ? 'w-20' : 'w-64'}
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* Header / Logo */}
        <div className={`flex items-center mb-8 px-5 gap-3 ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setCurrentView(homeView)}>
            <div className="w-10 h-10 bg-brand-primary rounded-xl flex items-center justify-center text-white font-bold text-xl shrink-0 shadow-sm transition-transform group-hover:scale-105">
              {APP_BRAND.monogram}
            </div>
            {!isCollapsed && <span className="font-bold text-lg tracking-tight text-text-primary whitespace-nowrap">{APP_BRAND.name}</span>}
          </div>
          
          {/* Botón cerrar (Solo Móvil) */}
          <button 
            className="md:hidden p-2 text-text-secondary hover:text-text-primary hover:bg-hover-bg rounded-lg transition-colors"
            onClick={() => setIsMobileOpen(false)}
          >
            <X size={20} />
          </button>
        </div>
        
        {/* Navegación Principal */}
        <nav className="flex-1 flex flex-col gap-1.5 w-full px-3">
          {isAdmin && (
            <NavItem 
              icon={<LayoutDashboard size={20} />} 
              active={currentView === 'dashboard'} 
              onClick={() => setCurrentView('dashboard')} 
              title={tTerm('sidebar.dashboard')} 
              isCollapsed={isCollapsed}
            />
          )}

          {/* Menú Clientes */}
          {isAdmin && (
          <div className="mt-1">
              <button 
                onClick={() => handleSectionClick('clientes', 'customers', isCustomersView)}
                data-active={isCollapsed && isCustomersView ? "true" : "false"}
                className={`w-full flex items-center p-3 rounded-xl transition-all duration-200 group relative ${
                isCollapsed ? 'justify-center' : 'justify-between gap-3'
              } ${
                isCustomersView && isCollapsed
                  ? 'bg-hover-bg text-brand-primary font-medium' 
                  : isCustomersView 
                    ? 'text-brand-primary font-medium' 
                    : 'text-text-secondary hover:text-text-primary hover:bg-hover-bg'
              }`}
              title={isCollapsed ? tTerm('sidebar.customers') : undefined}
            >
              <div className="flex items-center gap-3">
                <div className={`${isCustomersView ? 'text-brand-primary' : ''} transition-transform duration-200 group-hover:scale-110`}>
                  <Users size={20} />
                </div>
                {!isCollapsed && <span className="text-sm whitespace-nowrap">{tTerm('sidebar.customers')}</span>}
              </div>
              {!isCollapsed && (
                <div className={`transition-transform duration-200 ${openMenus['clientes'] ? 'rotate-180' : ''}`}>
                  <ChevronDown size={16} />
                </div>
              )}
              {isCustomersView && isCollapsed && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-brand-primary rounded-r-full" />
              )}
            </button>
            
            {openMenus['clientes'] && !isCollapsed && (
              <div className="flex flex-col gap-1 mt-1 ml-[22px] pl-3 border-l border-border-strong animate-in fade-in duration-200">
                <SubNavItem
                  active={currentView === 'customers'}
                  onClick={() => setCurrentView('customers')}
                  title={tTerm('sidebar.customers.directory')}
                  tooltip="Consulta y busca clientes registrados"
                />
                <SubNavItem
                  active={currentView === 'customers-new'}
                  onClick={() => setCurrentView('customers-new')}
                  title={tTerm('sidebar.customers.new')}
                  tooltip="Registra un cliente por primera vez"
                />
              </div>
            )}
          </div>
          )}

          {/* Menú Créditos */}
          {(isAdmin || isCustomer) && (
          <div className="mt-1">
              <button 
                onClick={() => handleSectionClick('creditos', 'credits', isCreditsView)}
                data-active={isCollapsed && isCreditsView ? "true" : "false"}
                className={`w-full flex items-center p-3 rounded-xl transition-all duration-200 group relative ${
                  isCollapsed ? 'justify-center' : 'justify-between gap-3'
                } ${
                  isCreditsView && isCollapsed
                    ? 'bg-hover-bg text-brand-primary font-medium'
                    : isCreditsView
                      ? 'text-brand-primary font-medium'
                      : 'text-text-secondary hover:text-text-primary hover:bg-hover-bg'
                }`}
              title={isCollapsed ? tTerm('sidebar.credits') : undefined}
            >
              <div className="flex items-center gap-3">
                <div className={`${isCreditsView ? 'text-brand-primary' : ''} transition-transform duration-200 group-hover:scale-110`}>
                  <CreditCard size={20} />
                </div>
                {!isCollapsed && <span className="text-sm whitespace-nowrap">{tTerm('sidebar.credits')}</span>}
              </div>
              {!isCollapsed && (
                <div className={`transition-transform duration-200 ${openMenus['creditos'] ? 'rotate-180' : ''}`}>
                  <ChevronDown size={16} />
                </div>
              )}
              {isCreditsView && isCollapsed && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-brand-primary rounded-r-full" />
              )}
            </button>
            
            {openMenus['creditos'] && !isCollapsed && (
              <div className="flex flex-col gap-1 mt-1 ml-[22px] pl-3 border-l border-border-strong animate-in fade-in duration-200">
                <SubNavItem
                  active={currentView === 'credits'}
                  onClick={() => setCurrentView('credits')}
                  title={tTerm('sidebar.credits.portfolio')}
                  tooltip="Creditos en curso con saldo o cuotas pendientes"
                />
                {isAdmin && (
                  <>
                <SubNavItem
                      active={currentView === 'credits-new' || currentView === 'credits/new'}
                      onClick={() => setCurrentView('credits-new')}
                      title={tTerm('sidebar.credits.origination')}
                      tooltip="Crear y registrar un credito nuevo"
                    />
                    <SubNavItem
                      active={currentView === 'reports'}
                      onClick={() => setCurrentView('reports')}
                      title={tTerm('sidebar.credits.reports')}
                      tooltip="Indicadores de cartera, mora y recaudo"
                    />
                  </>
                )}
                <SubNavItem
                  active={currentView === 'credit-calculator' || currentView === 'simulator'}
                  onClick={() => setCurrentView('credit-calculator')}
                  title="Cálculo de Crédito"
                  tooltip="Calcula cuotas con la fórmula activa del crédito"
                />

              </div>
            )}
          </div>
          )}

          {/* Menú Socios */}
          {(isAdmin || isSocio) && (
          <div className="mt-1">
              <button 
                onClick={() => handleSectionClick('socios', associatesHomeView, isAssociatesView)}
                data-active={isCollapsed && isAssociatesView ? "true" : "false"}
                className={`w-full flex items-center p-3 rounded-xl transition-all duration-200 group relative ${
                  isCollapsed ? 'justify-center' : 'justify-between gap-3'
                } ${
                  isAssociatesView && isCollapsed
                    ? 'bg-hover-bg text-brand-primary font-medium' 
                    : isAssociatesView
                      ? 'text-brand-primary font-medium' 
                      : 'text-text-secondary hover:text-text-primary hover:bg-hover-bg'
                }`}
              title={isCollapsed ? tTerm('sidebar.associates') : undefined}
            >
              <div className="flex items-center gap-3">
                <div className={`${isAssociatesView ? 'text-brand-primary' : ''} transition-transform duration-200 group-hover:scale-110`}>
                  <UserPlus size={20} />
                </div>
                {!isCollapsed && <span className="text-sm whitespace-nowrap">{tTerm('sidebar.associates')}</span>}
              </div>
              {!isCollapsed && (
                <div className={`transition-transform duration-200 ${openMenus['socios'] ? 'rotate-180' : ''}`}>
                  <ChevronDown size={16} />
                </div>
              )}
              {isAssociatesView && isCollapsed && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-brand-primary rounded-r-full" />
              )}
            </button>
            
            {openMenus['socios'] && !isCollapsed && (
              <div className="flex flex-col gap-1 mt-1 ml-[22px] pl-3 border-l border-border-strong animate-in fade-in duration-200">
                <SubNavItem
                  active={currentView === 'associates' || currentView.startsWith('associates/')}
                  onClick={() => setCurrentView(associatesHomeView)}
                  title={isSocio ? 'Mi portal' : tTerm('sidebar.associates.management')}
                />
              </div>
            )}
          </div>
          )}

          {/* Menú Formulas */}
          {isAdmin && (
          <div className="mt-1 border-t border-border-subtle pt-2 pb-1">
              <button
                onClick={() => handleSectionClick('formulas', 'formulas', currentView === 'formulas' || currentView.startsWith('formulas/'))}
                data-active={isCollapsed && (currentView === 'formulas' || currentView.startsWith('formulas/')) ? "true" : "false"}
                className={`w-full flex items-center p-3 rounded-xl transition-all duration-200 group relative ${
                  isCollapsed ? 'justify-center' : 'justify-between gap-3'
                } ${
                  (currentView === 'formulas' || currentView.startsWith('formulas/')) && isCollapsed
                    ? 'bg-hover-bg text-brand-primary font-medium'
                    : (currentView === 'formulas' || currentView.startsWith('formulas/'))
                      ? 'text-brand-primary font-medium'
                      : 'text-text-secondary hover:text-text-primary hover:bg-hover-bg'
                }`}
                title={isCollapsed ? 'Fórmulas' : undefined}
              >
                <div className="flex items-center gap-3">
                  <div className={`${(currentView === 'formulas' || currentView.startsWith('formulas/')) ? 'text-brand-primary' : ''} transition-transform duration-200 group-hover:scale-110`}>
                    <FlaskConical size={20} />
                  </div>
                  {!isCollapsed && <span className="text-sm whitespace-nowrap">Fórmulas</span>}
                </div>
                {!isCollapsed && (
                  <div className={`transition-transform duration-200 ${openMenus['formulas'] ? 'rotate-180' : ''}`}>
                    <ChevronDown size={16} />
                  </div>
                )}
                {(currentView === 'formulas' || currentView.startsWith('formulas/')) && isCollapsed && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-brand-primary rounded-r-full" />
                )}
              </button>

              {openMenus['formulas'] && !isCollapsed && (
                <div className="flex flex-col gap-1 mt-1 ml-[22px] pl-3 border-l border-border-strong animate-in fade-in duration-200">
                  <SubNavItem
                    active={currentView === 'formulas' || currentView.startsWith('formulas/') && currentView !== 'formulas/variables'}
                    onClick={() => setCurrentView('formulas')}
                    title="Editor"
                    tooltip="Gestiona versiones activas y reglas de cálculo"
                  />
                  <SubNavItem
                    active={currentView === 'formulas/variables'}
                    onClick={() => setCurrentView('formulas/variables')}
                    title="Variables"
                    tooltip="Administra parámetros usados por las fórmulas"
                  />
                </div>
              )}

            <NavItem
              icon={<DollarSign size={20} />}
              active={currentView === 'payouts'}
              onClick={() => setCurrentView('payouts')}
              title={tTerm('sidebar.payouts')}
              tooltip="Registra pagos, consulta recibos y seguimiento de cobranza"
              isCollapsed={isCollapsed}
            />
          </div>
          )}

          <div className="mt-1 border-t border-border-subtle pt-2 pb-1">
            <NavItem 
              icon={<CreditCard size={20} />} 
              active={currentView === 'notifications'} 
              onClick={() => setCurrentView('notifications')} 
              title="Notificaciones" 
              isCollapsed={isCollapsed}
            />
          </div>

        </nav>

        {/* Footer Sidebar (Ajustes y Colapso) */}
        <div className="flex flex-col gap-1 w-full px-3 mt-auto pt-6 border-t border-border-subtle">
          {isAdmin && <NavItem icon={<ClipboardList size={20} />} active={currentView === 'audit-log'} onClick={() => setCurrentView('audit-log')} title={tTerm('sidebar.audit')} isCollapsed={isCollapsed} />}
          {isAdmin && <NavItem icon={<Settings size={20} />} active={currentView === 'settings'} onClick={() => setCurrentView('settings')} title={tTerm('sidebar.settings')} isCollapsed={isCollapsed} />}
          <NavItem icon={<UserRound size={20} />} active={currentView === 'profile'} onClick={() => setCurrentView('profile')} title="Perfil" isCollapsed={isCollapsed} />
          <NavItem
            icon={<LogOut size={20} />}
            onClick={handleLogout}
            title={isLoggingOut ? 'Cerrando sesión...' : tTerm('sidebar.logout')}
            isCollapsed={isCollapsed}
            className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
          />
          
          {/* Botón Colapsar (Solo Escritorio) */}
          <button 
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden md:flex mt-4 w-full items-center justify-center p-3 rounded-xl text-text-secondary hover:text-text-primary hover:bg-hover-bg transition-colors"
            title={isCollapsed ? "Expandir menú" : "Colapsar menú"}
          >
            {isCollapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
          </button>
        </div>
      </aside>
    </>
  );
}

// Subcomponente de Ítem de Navegación Principal
const NavItem = React.forwardRef<HTMLButtonElement, { icon: React.ReactNode; active?: boolean; onClick?: () => void; title: string, tooltip?: string, isCollapsed?: boolean, className?: string }>(({ icon, active, onClick, title, tooltip, isCollapsed, className }, ref) => {
  return (
    <button 
      ref={ref}
      onClick={onClick}
      title={isCollapsed ? title : tooltip}
      data-active={active ? "true" : "false"}
      className={`w-full flex items-center p-3 rounded-xl transition-all duration-200 group relative ${
        isCollapsed ? 'justify-center' : 'justify-start gap-3'
      } ${
        active 
          ? 'bg-hover-bg text-brand-primary font-medium' 
          : className || 'text-text-secondary hover:text-text-primary hover:bg-hover-bg'
      }`}
    >
      <div className={`${active ? 'text-brand-primary' : ''} transition-transform duration-200 group-hover:scale-110`}>
        {icon}
      </div>
      {!isCollapsed && <span className="text-sm whitespace-nowrap">{title}</span>}
      
      {/* Indicador lateral sutil */}
      {active && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-brand-primary rounded-r-full" />
      )}
    </button>
  );
});
NavItem.displayName = 'NavItem';

// Subcomponente de Ítem Anidado
function SubNavItem({ active, onClick, title, tooltip }: { active?: boolean; onClick?: () => void; title: string; tooltip?: string }) {
  return (
    <button 
      onClick={onClick}
      title={tooltip}
      data-active={active ? "true" : "false"}
      className={`w-full flex items-center text-left py-2 px-3 rounded-lg transition-colors text-sm relative group ${
        active 
          ? 'text-brand-primary font-medium bg-brand-primary/5' 
          : 'text-text-secondary hover:text-text-primary hover:bg-hover-bg'
      }`}
    >
      {title}
    </button>
  );
}
