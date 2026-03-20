import { Suspense, lazy, useEffect } from "react";
import "./App.scss"; 
import { useSessionStore } from './store/sessionStore';
import { useUiStore } from './store/uiStore';
import Layout from './components/layout/Layout';

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
  const notificationsOpen = useUiStore((state) => state.notificationsOpen);
  const setNotificationsOpen = useUiStore((state) => state.setNotificationsOpen);

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

  if (!user) {
    return (
      <Suspense fallback={<ScreenFallback label="Loading home..." />}>
        <Home onLogin={handleLogin} />
      </Suspense>
    );
  }

  const ActiveView = viewComponents[currentView] || Dashboard;

  return (
    <>
      <Layout>
        <Suspense fallback={<ScreenFallback label="Loading workspace..." />}>
          <ActiveView user={user} />
        </Suspense>
      </Layout>
      {notificationsOpen && (
        <Suspense fallback={null}>
          <Notifications user={user} isOpen={notificationsOpen} onClose={() => setNotificationsOpen(false)} />
        </Suspense>
      )}
    </>
  );
}

export default App;
