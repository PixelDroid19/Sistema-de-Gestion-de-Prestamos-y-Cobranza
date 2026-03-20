import { Suspense, lazy, useEffect } from "react";
import "./App.css"; 
import { Search, Bell, Settings, Moon, Sun, LayoutDashboard, Briefcase, CreditCard, Users, PieChart } from "lucide-react";
import { useSessionStore } from './store/sessionStore';
import { useUiStore } from './store/uiStore';
import { useUnreadCountQuery } from './hooks/useNotifications';

const Home = lazy(() => import('./pages/Home'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Loans = lazy(() => import('./pages/Loans'));
const Payments = lazy(() => import('./pages/Payments'));
const AgentsPage = lazy(() => import('./pages/AgentsPage'));
const Reports = lazy(() => import('./pages/Reports'));
const Notifications = lazy(() => import('./components/Notifications'));

const viewComponents = {
  Dashboard,
  Loans,
  Payments,
  Agents: AgentsPage,
  Reports,
};

function ScreenFallback({ label }) {
  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '240px', color: 'var(--text-secondary)' }}>
      {label}
    </div>
  );
}

function App() {
  const user = useSessionStore((state) => state.user);
  const bootstrapSession = useSessionStore((state) => state.bootstrapSession);
  const logout = useSessionStore((state) => state.logout);
  const currentView = useUiStore((state) => state.currentView);
  const setCurrentView = useUiStore((state) => state.setCurrentView);
  const isDarkMode = useUiStore((state) => state.isDarkMode);
  const toggleTheme = useUiStore((state) => state.toggleTheme);
  const notificationsOpen = useUiStore((state) => state.notificationsOpen);
  const setNotificationsOpen = useUiStore((state) => state.setNotificationsOpen);
  const unreadCountQuery = useUnreadCountQuery({
    enabled: Boolean(user),
    refetchInterval: user ? 30000 : false,
  });

  useEffect(() => {
    bootstrapSession();
  }, [bootstrapSession]);

  useEffect(() => {
    const handleSessionExpired = () => {
      logout();
      alert("Your session has expired due to inactivity. Please log in again.");
    };

    window.addEventListener("sessionExpired", handleSessionExpired);

    return () => {
      window.removeEventListener("sessionExpired", handleSessionExpired);
    };
  }, [logout]);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  }, [isDarkMode]);

  const handleLogin = () => {
    setCurrentView("Dashboard");
  };

  const handleLogout = () => {
    logout();
  };

  if (!user) {
    return (
      <Suspense fallback={<ScreenFallback label="Loading home..." />}>
        <Home onLogin={handleLogin} />
      </Suspense>
    );
  }

  // Define menu based on user role
  const getMenuItems = () => {
    if (user.role === "socio") {
      return [
        { id: "Dashboard", label: "Dashboard", icon: LayoutDashboard },
        { id: "Loans", label: "Loans", icon: Briefcase },
        { id: "Reports", label: "Partner Portal", icon: PieChart },
      ];
    }

    const items = [
      { id: "Dashboard", label: "Dashboard", icon: LayoutDashboard },
      { id: "Loans", label: "Loans", icon: Briefcase },
      { id: "Payments", label: "Payments", icon: CreditCard },
    ];
    
    if (user.role === "admin") {
      items.push({ id: "Agents", label: "Agents", icon: Users });
      items.push({ id: "Reports", label: "Reports", icon: PieChart });
    }

    if (user.role === "socio") {
      items.push({ id: "Reports", label: "Partner Portal", icon: PieChart });
    }
    
    return items;
  };

  const ActiveView = viewComponents[currentView] || Dashboard;

  return (
    <div className="layout-container">
      <aside className="sidebar">
        <div className="sidebar-brand">
          {/* Faux logo matching image (yellow bird placeholder) */}
          <div style={{color: '#EAB308', display: 'flex'}}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><path d="m9 11 3 3L22 4"></path></svg>
          </div>
        </div>
        <nav className="sidebar-nav">
          <ul>
            {getMenuItems().map(item => {
              const Icon = item.icon;
              return (
                <li 
                  key={item.id} 
                  className={currentView === item.id ? "active" : ""}
                  onClick={() => setCurrentView(item.id)}
                  title={item.label}
                >
                  <Icon size={22} strokeWidth={2.5} />
                </li>
              );
            })}
          </ul>
        </nav>
        
        {/* Bottom icon in sidebar for logout/exit */}
        <div style={{marginTop: "auto", marginBottom: "1rem"}}>
           <button onClick={handleLogout} style={{width: '48px', height: '48px', color: 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '14px', transition: 'all 0.2s', cursor: 'pointer', border: 'none', background: 'transparent'}} title="Logout" onMouseOver={(e)=>e.currentTarget.style.color='#fff'} onMouseOut={(e)=>e.currentTarget.style.color='rgba(255,255,255,0.6)'}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
           </button>
        </div>
      </aside>

      <div className="main-wrapper">
        <header className="top-header">
          <div className="search-bar">
            <Search className="search-icon-static" size={20} strokeWidth={2.5} />
            <input type="text" placeholder="SEARCH OR TYPE COMMAND" />
          </div>
          <div className="header-actions">
            <button className="icon-btn" title="Settings">
              <Settings size={20} strokeWidth={2.5} />
            </button>
            <button className="icon-btn" title="Toggle Theme" onClick={toggleTheme}>
              {isDarkMode ? <Sun size={20} strokeWidth={2.5} /> : <Moon size={20} strokeWidth={2.5} />}
            </button>
            <button className="icon-btn" title="Notifications" onClick={() => setNotificationsOpen(true)}>
              <Bell size={20} strokeWidth={2.5} />
              {unreadCountQuery.data?.data?.unreadCount > 0 && (
                <span className="notification-badge">{unreadCountQuery.data.data.unreadCount}</span>
              )}
            </button>
            <div className="user-profile" title="Click for options">
              <div className="user-info">
                <span className="user-name">{user.name}</span>
              </div>
              <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=${user.name}&backgroundColor=f1f5f9`} alt="Avatar" />
            </div>
          </div>
        </header>

        <main className="content-area">
          <Suspense fallback={<ScreenFallback label="Loading workspace..." />}>
            <ActiveView user={user} />
          </Suspense>
        </main>
      </div>
      {notificationsOpen && (
        <Suspense fallback={null}>
          <Notifications user={user} isOpen={notificationsOpen} onClose={() => setNotificationsOpen(false)} />
        </Suspense>
      )}
    </div>
  );
}

export default App;
