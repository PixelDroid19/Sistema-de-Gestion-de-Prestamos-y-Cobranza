import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Users, UserPlus, CreditCard, DollarSign, Settings, LogOut, ChevronDown, ClipboardList, X, PanelLeftClose, PanelLeftOpen, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSessionStore } from '../store/sessionStore';
import { tTerm } from '../i18n/terminology';
import { getDefaultRouteForUser } from '../constants/appAccess';
import { APP_BRAND } from '../constants/appShell';
import { useAuth } from '../services/authService';
import { useMyPermissions } from '../services/permissionsService';
import { ClickableSurface, IconActionButton } from './shared/Surfaces';

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
  });
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const isCustomersView = currentView === 'customers' || currentView.startsWith('customers/');
  const isCreditsView = currentView.startsWith('credit') || currentView === 'reports' || currentView === 'simulator';
  const isAssociatesView = currentView.startsWith('associate');
  const { user, logout: clearSession } = useSessionStore();
  const { logout: requestLogout } = useAuth();
  const { permissions: myPermissions } = useMyPermissions();
  const resolvedRole = user?.role;
  const isAdmin = resolvedRole === 'admin';
  const isEmployee = resolvedRole === 'employee';
  const permissionSet = new Set(
    (myPermissions || [])
      .map((permission: any) => permission?.permission ?? permission?.name ?? permission)
      .filter((permission): permission is string => typeof permission === 'string'),
  );
  const canAccess = (permission: string) => isAdmin || (isEmployee && permissionSet.has(permission));
  const canViewDashboard = canAccess('DASHBOARD_VIEW_ALL');
  const canViewCustomers = canAccess('CLIENTS_VIEW_ALL');
  const canCreateCustomers = canAccess('CLIENTS_CREATE');
  const canViewCredits = canAccess('CREDITS_VIEW_ALL');
  const canCreateCredits = canAccess('CREDITS_CREATE') && canAccess('CREDITS_VIEW_ALL');
  const canViewReports = canAccess('REPORTS_VIEW_ALL');
  const canViewAssociates = canAccess('SOCIOS_VIEW_ALL');
  const canViewPayouts = canAccess('PAYMENTS_VIEW_ALL');
  const canViewAudit = canAccess('AUDIT_VIEW_ALL');
  const homeView = getDefaultRouteForUser(user).replace(/^\//u, '');
  
  // Ocultar submenús al colapsar el sidebar en escritorio
  useEffect(() => {
    if (isCollapsed) {
       setOpenMenus({ clientes: false, creditos: false, socios: false });
    }
  }, [isCollapsed]);

  const handleSectionClick = (key: 'clientes' | 'creditos' | 'socios', nextView: string, isSectionActive: boolean) => {
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
    const remoteLogout = requestLogout().catch(() => undefined);
    clearSession();
    setIsMobileOpen(false);
    navigate('/login', { replace: true });

    try {
      await Promise.race([
        remoteLogout,
        new Promise((resolve) => setTimeout(resolve, 1500)),
      ]);
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <button
          type="button"
          aria-label="Cerrar menú lateral"
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden animate-in fade-in"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside className={`
        fixed md:static inset-y-0 left-0 z-50
        app-glass-surface flex flex-col py-6 border-r border-border-subtle shrink-0 overflow-hidden
        transition-all duration-300 ease-in-out shadow-2xl md:shadow-none
        ${isCollapsed ? 'w-20' : 'w-64'}
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* Header / Logo */}
        <div className={`flex shrink-0 items-center mb-8 px-5 gap-3 ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
          <ClickableSurface
            variant="list"
            className="flex items-center gap-3 cursor-pointer group text-left"
            onClick={() => setCurrentView(homeView)}
            aria-label={`Ir a ${APP_BRAND.name}`}
          >
            <div className="size-10 rounded-xl flex items-center justify-center bg-brand-primary text-white font-bold text-xl shrink-0 shadow-[0_10px_24px_-14px_rgba(20,95,116,0.7)] transition-transform group-hover:scale-105">
              {APP_BRAND.monogram}
            </div>
            {!isCollapsed && <span className="font-bold text-lg tracking-tight text-text-primary whitespace-nowrap">{APP_BRAND.name}</span>}
          </ClickableSurface>
          
          {/* Botón cerrar (Solo Móvil) */}
          <IconActionButton
            className="md:hidden"
            label="Cerrar menú"
            icon={<X size={20} />}
            onClick={() => setIsMobileOpen(false)}
          />
        </div>
        
        {/* Navegación Principal */}
        <nav className="flex min-h-0 flex-1 flex-col gap-1.5 w-full overflow-y-auto px-3">
          {canViewDashboard && (
            <NavItem 
              icon={<LayoutDashboard size={20} />} 
              active={currentView === 'dashboard'} 
              onClick={() => setCurrentView('dashboard')} 
              title={tTerm('sidebar.dashboard')} 
              isCollapsed={isCollapsed}
            />
          )}

          {/* Menú Clientes */}
          {(canViewCustomers || canCreateCustomers) && (
          <div className="mt-1">
              <SectionNavButton
                icon={<Users size={20} />}
                label={tTerm('sidebar.customers')}
                active={isCustomersView}
                isCollapsed={isCollapsed}
                isOpen={openMenus['clientes']}
                onClick={() => handleSectionClick('clientes', 'customers', isCustomersView)}
              />
            
            {openMenus['clientes'] && !isCollapsed && (
                  <div className="mt-1 ml-[22px] flex flex-col gap-1 border-l border-border-subtle pl-3 animate-in fade-in duration-200">
                {canViewCustomers && (
                  <SubNavItem
                    active={currentView === 'customers'}
                    onClick={() => setCurrentView('customers')}
                    title={tTerm('sidebar.customers.directory')}
                    tooltip="Consulta y busca clientes registrados"
                  />
                )}
                {canCreateCustomers && (
                  <SubNavItem
                    active={currentView === 'customers-new'}
                    onClick={() => setCurrentView('customers-new')}
                    title={tTerm('sidebar.customers.new')}
                    tooltip="Registra un cliente por primera vez"
                  />
                )}
              </div>
            )}
          </div>
          )}

          {/* Menú Créditos */}
          {(canViewCredits || canCreateCredits || canViewReports) && (
          <div className="mt-1">
              <SectionNavButton
                icon={<CreditCard size={20} />}
                label={tTerm('sidebar.credits')}
                active={isCreditsView}
                isCollapsed={isCollapsed}
                isOpen={openMenus['creditos']}
                onClick={() => handleSectionClick('creditos', 'credits', isCreditsView)}
              />
            
            {openMenus['creditos'] && !isCollapsed && (
              <div className="mt-1 ml-[22px] flex flex-col gap-1 border-l border-border-subtle pl-3 animate-in fade-in duration-200">
                {canViewCredits && (
                  <SubNavItem
                    active={currentView === 'credits'}
                    onClick={() => setCurrentView('credits')}
                    title={tTerm('sidebar.credits.portfolio')}
                    tooltip="Créditos en curso con saldo o cuotas pendientes"
                  />
                )}
                {canCreateCredits && (
                  <SubNavItem
                      active={currentView === 'credits-new' || currentView === 'credits/new'}
                      onClick={() => setCurrentView('credits-new')}
                      title={tTerm('sidebar.credits.origination')}
                      tooltip="Crear y registrar un credito nuevo"
                    />
                )}
                {canViewReports && (
                    <SubNavItem
                      active={currentView === 'reports'}
                      onClick={() => setCurrentView('reports')}
                      title={tTerm('sidebar.credits.reports')}
                      tooltip="Indicadores de cartera, mora y recaudo"
                    />
                )}
                {canViewCredits && (
                  <SubNavItem
                    active={currentView === 'credit-calculator' || currentView === 'simulator'}
                    onClick={() => setCurrentView('credit-calculator')}
                    title="Cálculo de Crédito"
                    tooltip="Calcula cuotas con la regla activa del crédito"
                  />
                )}

              </div>
            )}
          </div>
          )}

          {/* Menú Socios */}
          {canViewAssociates && (
          <div className="mt-1">
              <SectionNavButton
                icon={<UserPlus size={20} />}
                label={tTerm('sidebar.associates')}
                active={isAssociatesView}
                isCollapsed={isCollapsed}
                isOpen={openMenus['socios']}
                onClick={() => handleSectionClick('socios', 'associates', isAssociatesView)}
              />
            
            {openMenus['socios'] && !isCollapsed && (
              <div className="mt-1 ml-[22px] flex flex-col gap-1 border-l border-border-subtle pl-3 animate-in fade-in duration-200">
                <SubNavItem
                  active={currentView === 'associates' || currentView.startsWith('associates/')}
                  onClick={() => setCurrentView('associates')}
                  title={tTerm('sidebar.associates.management')}
                />
              </div>
            )}
          </div>
          )}

          {canViewPayouts && (
            <div className="mt-1 border-t border-border-subtle pt-2 pb-1">
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
        <div className="flex shrink-0 flex-col gap-1 w-full px-3 mt-4 pt-4 border-t border-border-subtle">
          {canViewAudit && <NavItem icon={<ClipboardList size={20} />} active={currentView === 'audit-log'} onClick={() => setCurrentView('audit-log')} title={tTerm('sidebar.audit')} isCollapsed={isCollapsed} />}
          {isAdmin && <NavItem icon={<Settings size={20} />} active={currentView === 'settings'} onClick={() => setCurrentView('settings')} title={tTerm('sidebar.settings')} isCollapsed={isCollapsed} />}
          <NavItem icon={<UserRound size={20} />} active={currentView === 'profile'} onClick={() => setCurrentView('profile')} title="Perfil" isCollapsed={isCollapsed} />
          <NavItem
            icon={<LogOut size={20} />}
            onClick={handleLogout}
            title={isLoggingOut ? 'Cerrando sesión…' : tTerm('sidebar.logout')}
            isCollapsed={isCollapsed}
            className="text-text-secondary hover:text-text-primary hover:bg-hover-bg"
          />
          
          {/* Botón Colapsar (Solo Escritorio) */}
          <IconActionButton
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="mt-4 hidden w-full md:flex"
            label={isCollapsed ? "Expandir menú" : "Colapsar menú"}
            icon={isCollapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
          />
        </div>
      </aside>
    </>
  );
}

function SectionNavButton({
  icon,
  label,
  active,
  isCollapsed,
  isOpen,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  isCollapsed: boolean;
  isOpen: boolean;
  onClick: () => void;
}) {
  return (
    <ClickableSurface
      variant="list"
      onClick={onClick}
      data-active={isCollapsed && active ? 'true' : 'false'}
      className={`w-full flex items-center p-3 rounded-xl transition-all duration-200 group relative ${
        isCollapsed ? 'justify-center' : 'justify-between gap-3'
      } ${
        active && isCollapsed
          ? 'bg-brand-primary/12 text-text-primary font-semibold dark:bg-brand-primary/25 dark:text-text-primary'
          : active
            ? 'text-text-primary font-semibold'
            : 'text-text-secondary hover:text-text-primary hover:bg-hover-bg'
      }`}
      title={isCollapsed ? label : undefined}
    >
      <span className="flex items-center gap-3">
        <span className={`${active ? 'text-text-primary' : ''} transition-transform duration-200 group-hover:scale-110`}>
          {icon}
        </span>
        {!isCollapsed && <span className="text-sm whitespace-nowrap">{label}</span>}
      </span>
      {!isCollapsed && (
        <span className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
          <ChevronDown size={16} />
        </span>
      )}
      {active && isCollapsed && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-brand-primary rounded-r-full" />
      )}
    </ClickableSurface>
  );
}

// Subcomponente de Ítem de Navegación Principal
const NavItem = React.forwardRef<HTMLButtonElement, { icon: React.ReactNode; active?: boolean; onClick?: () => void; title: string, tooltip?: string, isCollapsed?: boolean, className?: string }>(({ icon, active, onClick, title, tooltip, isCollapsed, className }, ref) => {
  return (
    <ClickableSurface
      variant="list"
      ref={ref}
      onClick={onClick}
      title={isCollapsed ? title : tooltip}
      data-active={active ? "true" : "false"}
      className={`w-full flex items-center p-3 rounded-xl transition-all duration-200 group relative ${
        isCollapsed ? 'justify-center' : 'justify-start gap-3'
      } ${
        active 
          ? 'bg-brand-primary/12 text-text-primary font-semibold dark:bg-brand-primary/25 dark:text-text-primary' 
          : className || 'text-text-secondary hover:text-text-primary hover:bg-hover-bg'
      }`}
    >
      <div className={`${active ? 'text-text-primary' : ''} transition-transform duration-200 group-hover:scale-110`}>
        {icon}
      </div>
      {!isCollapsed && <span className="text-sm whitespace-nowrap">{title}</span>}
      
      {/* Indicador lateral sutil */}
      {active && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-brand-primary rounded-r-full" />
      )}
    </ClickableSurface>
  );
});
NavItem.displayName = 'NavItem';

// Subcomponente de Ítem Anidado
function SubNavItem({ active, onClick, title, tooltip }: { active?: boolean; onClick?: () => void; title: string; tooltip?: string }) {
  return (
    <ClickableSurface
      variant="list"
      onClick={onClick}
      title={tooltip}
      data-active={active ? "true" : "false"}
      className={`w-full flex items-center text-left py-2.5 px-3 rounded-lg transition-colors text-sm relative group ${
        active
          ? 'bg-brand-primary/12 font-semibold text-text-primary ring-1 ring-inset ring-brand-primary/20 dark:bg-brand-primary/18 dark:text-text-primary dark:ring-brand-primary/30'
          : 'text-text-secondary hover:text-text-primary hover:bg-hover-bg'
      }`}
    >
      {title}
    </ClickableSurface>
  );
}
