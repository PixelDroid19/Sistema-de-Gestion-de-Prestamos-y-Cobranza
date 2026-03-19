import { Suspense, lazy, useEffect } from "react";
import "./App.css"; 
import { Search, Bell, ChevronDown, CheckCircle, Moon, Sun } from "lucide-react";
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
        { id: "Dashboard", label: "Dashboard" },
        { id: "Loans", label: "Loans" },
        { id: "Reports", label: "Partner Portal" },
      ];
    }

    const items = [
      { id: "Dashboard", label: "Dashboard" },
      { id: "Loans", label: "Loans" },
      { id: "Payments", label: "Payments" },
    ];
    
    if (user.role === "admin") {
      items.push({ id: "Agents", label: "Agents" });
      items.push({ id: "Reports", label: "Reports" });
    }

    if (user.role === "socio") {
      items.push({ id: "Reports", label: "Partner Portal" });
    }
    
    return items;
  };

  const ActiveView = viewComponents[currentView] || Dashboard;

  return (
    <div className="layout-container">
      <aside className="sidebar">
        <div className="sidebar-brand">LendFlow</div>
        <nav className="sidebar-nav">
          <p className="nav-title">Main Menu</p>
          <ul>
            {getMenuItems().map(item => (
              <li 
                key={item.id} 
                className={currentView === item.id ? "active" : ""}
                onClick={() => setCurrentView(item.id)}
              >
                {item.label}
              </li>
            ))}
          </ul>
        </nav>
        
        {/* Customizable theme controls */}
        <div className="sidebar-footer" style={{marginTop: "auto", borderTop: "1px solid var(--border-color)", paddingTop: "1rem"}}>
           <p className="nav-title">Theme System</p>
           <button onClick={toggleTheme} className="theme-toggle-btn flex items-center gap-2" style={{color: "var(--text-secondary)", fontSize: "0.9rem", padding: "0.5rem 0"}}>
              {isDarkMode ? <Sun size={16}/> : <Moon size={16} />}
              {isDarkMode ? "Light Mode" : "Dark Mode"}
           </button>
           <div className="theme-colors flex gap-2 mt-2">
             <div onClick={()=>document.documentElement.style.setProperty("--accent-color", "#3b3f5c")} style={{width: 20, height: 20, borderRadius: "50%", background: "#3b3f5c", cursor: "pointer"}} title="Classic"></div>
             <div onClick={()=>document.documentElement.style.setProperty("--accent-color", "#0066cc")} style={{width: 20, height: 20, borderRadius: "50%", background: "#0066cc", cursor: "pointer"}} title="Blue"></div>
             <div onClick={()=>document.documentElement.style.setProperty("--accent-color", "#16a34a")} style={{width: 20, height: 20, borderRadius: "50%", background: "#16a34a", cursor: "pointer"}} title="Green"></div>
           </div>
        </div>

      </aside>

      <div className="main-wrapper">
        <header className="top-header">
          <div className="search-bar">
            <input type="text" placeholder="Search information" />
            <button className="search-btn">
              <Search size={16} />
            </button>
          </div>
          <div className="header-actions">
            <button className="icon-btn" title="Notifications" onClick={() => setNotificationsOpen(true)}>
              <Bell size={18} />
              {unreadCountQuery.data?.data?.unreadCount > 0 && (
                <span className="notification-badge">{unreadCountQuery.data.data.unreadCount}</span>
              )}
            </button>
            <button className="icon-btn" title="System secured" style={{cursor: "default"}}>
              <CheckCircle size={18} color="#34c38f" />
            </button>
            <div className="user-profile" onClick={handleLogout} title="Click to logout">
              <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=${user.name}`} alt="Avatar" />
              <div className="user-info">
                <span className="user-name">{user.name}</span>
                <span className="user-role" style={{textTransform: "capitalize"}}>{user.role}</span>
              </div>
              <ChevronDown size={16} />
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

