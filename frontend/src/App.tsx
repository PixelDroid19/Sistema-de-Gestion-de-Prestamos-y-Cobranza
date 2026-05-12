/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Toaster } from './lib/toast';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import { GuestRoute, ProtectedRoute } from './components/ProtectedRoute';
import { useSessionStore } from './store/sessionStore';
import { getDefaultRouteForUser } from './constants/appAccess';

const Dashboard = React.lazy(() => import('./components/Dashboard'));
const Customers = React.lazy(() => import('./components/Customers'));
const CustomerDetails = React.lazy(() => import('./components/CustomerDetails'));
const NewCustomer = React.lazy(() => import('./components/NewCustomer'));
const Credits = React.lazy(() => import('./components/Credits'));
const NewCredit = React.lazy(() => import('./components/NewCredit'));
const CreditDetails = React.lazy(() => import('./components/CreditDetails'));
const Associates = React.lazy(() => import('./components/Associates'));
const AssociateDetails = React.lazy(() => import('./components/AssociateDetails'));
const Payouts = React.lazy(() => import('./components/Payouts'));
const Notifications = React.lazy(() => import('./components/Notifications'));
const Reports = React.lazy(() => import('./components/Reports'));
const Settings = React.lazy(() => import('./components/Settings'));
const Profile = React.lazy(() => import('./components/Profile'));
const Login = React.lazy(() => import('./components/Login'));
const AuditLogPage = React.lazy(() => import('./components/AuditLogPage'));
const NewAssociate = React.lazy(() => import('./components/NewAssociate'));
const CreditSimulator = React.lazy(() => import('./components/CreditSimulator'));
const PaymentSchedule = React.lazy(() => import('./components/PaymentSchedule'));


function RouteLoadingFallback() {
  return (
    <div className="flex min-h-[240px] items-center justify-center">
      <div className="flex items-center gap-3 rounded-xl border border-border-subtle bg-bg-surface px-4 py-3 text-sm text-text-secondary shadow-sm">
        <div className="size-4 animate-spin rounded-full border-2 border-brand-primary border-t-transparent" />
        Cargando módulo…
      </div>
    </div>
  );
}

function RoleHomeRedirect() {
  const { user } = useSessionStore();
  return <Navigate to={getDefaultRouteForUser(user)} replace />;
}

function AssociatesLandingRoute({ setCurrentView }: { setCurrentView: (view: string) => void }) {
  return <Associates setCurrentView={setCurrentView} />;
}

function MainLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentView = location.pathname.substring(1) || 'dashboard';
  const [isSidebarCollapsed, setIsSidebarCollapsed] = React.useState(false);
  const [isMobileOpen, setIsMobileOpen] = React.useState(false);

  const setCurrentView = (view: string) => {
    navigate(`/${view}`);
    setIsMobileOpen(false);
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-bg-base text-text-primary font-sans">
      <Sidebar 
        currentView={currentView} 
        setCurrentView={setCurrentView} 
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
        isMobileOpen={isMobileOpen}
        setIsMobileOpen={setIsMobileOpen}
      />
      <div className="flex flex-col flex-1 min-w-0">
        <Header setCurrentView={setCurrentView} toggleMobileSidebar={() => setIsMobileOpen(true)} />
        <main className="flex-1 overflow-y-auto bg-bg-base p-4 sm:p-6 lg:p-8">
          <React.Suspense fallback={<RouteLoadingFallback />}>
            <Routes>
              <Route path="/" element={<RoleHomeRedirect />} />
              <Route
                path="/dashboard"
                element={(
                  <ProtectedRoute allowedRoles={['admin', 'employee']} requiredPermissions={['DASHBOARD_VIEW_ALL']}>
                    <Dashboard />
                  </ProtectedRoute>
                )}
              />
              <Route path="/customers" element={<ProtectedRoute allowedRoles={['admin', 'employee']} requiredPermissions={['CLIENTS_VIEW_ALL']}><Customers setCurrentView={setCurrentView} /></ProtectedRoute>} />
              <Route path="/customers/:id" element={<ProtectedRoute allowedRoles={['admin', 'employee']} requiredPermissions={['CLIENTS_VIEW_ALL']}><CustomerDetails /></ProtectedRoute>} />
              <Route path="/customers-new" element={<ProtectedRoute allowedRoles={['admin', 'employee']} requiredPermissions={['CLIENTS_CREATE']}><NewCustomer onBack={() => setCurrentView('customers')} /></ProtectedRoute>} />
              <Route path="/customers/:id/edit" element={<ProtectedRoute allowedRoles={['admin', 'employee']} requiredPermissions={['CLIENTS_UPDATE']}><NewCustomer onBack={() => setCurrentView('customers')} /></ProtectedRoute>} />
              <Route path="/credits" element={<ProtectedRoute allowedRoles={['admin', 'employee']} requiredPermissions={['CREDITS_VIEW_ALL']}><Credits setCurrentView={setCurrentView} /></ProtectedRoute>} />
              <Route path="/credits-new" element={<ProtectedRoute allowedRoles={['admin', 'employee']} requiredPermissions={['CREDITS_CREATE']}><NewCredit onBack={() => setCurrentView('credits')} /></ProtectedRoute>} />
              <Route path="/credits/new" element={<ProtectedRoute allowedRoles={['admin', 'employee']} requiredPermissions={['CREDITS_CREATE']}><NewCredit onBack={() => setCurrentView('credits')} /></ProtectedRoute>} />
              <Route path="/new-credit" element={<Navigate to="/credits-new" replace />} />
              <Route path="/credits/:id" element={<ProtectedRoute allowedRoles={['admin', 'employee']} requiredPermissions={['CREDITS_VIEW_ALL']}><CreditDetails /></ProtectedRoute>} />
              <Route path="/credits/:id/schedule" element={<ProtectedRoute allowedRoles={['admin', 'employee']} requiredPermissions={['CREDITS_VIEW_ALL']}><PaymentSchedule /></ProtectedRoute>} />
              <Route path="/associates" element={<ProtectedRoute allowedRoles={['admin', 'employee']} requiredPermissions={['SOCIOS_VIEW_ALL']}><AssociatesLandingRoute setCurrentView={setCurrentView} /></ProtectedRoute>} />
              <Route path="/associates-new" element={<ProtectedRoute allowedRoles={['admin', 'employee']} requiredPermissions={['SOCIOS_CREATE']}><NewAssociate onBack={() => setCurrentView('associates')} /></ProtectedRoute>} />
              <Route path="/associates/:id/edit" element={<ProtectedRoute allowedRoles={['admin', 'employee']} requiredPermissions={['SOCIOS_UPDATE']}><NewAssociate onBack={() => setCurrentView('associates')} /></ProtectedRoute>} />
              <Route path="/associates/:id" element={<ProtectedRoute allowedRoles={['admin', 'employee']} requiredPermissions={['SOCIOS_VIEW_ALL']}><AssociateDetails /></ProtectedRoute>} />

              <Route path="/payouts" element={<ProtectedRoute allowedRoles={['admin', 'employee']} requiredPermissions={['PAYMENTS_VIEW_ALL']}><Payouts /></ProtectedRoute>} />
              <Route path="/notifications" element={<ProtectedRoute allowedRoles={['admin', 'employee']}><Notifications /></ProtectedRoute>} />
              <Route path="/reports" element={<ProtectedRoute allowedRoles={['admin', 'employee']} requiredPermissions={['REPORTS_VIEW_ALL']}><Reports /></ProtectedRoute>} />
              <Route path="/credit-calculator" element={<ProtectedRoute allowedRoles={['admin', 'employee']} requiredPermissions={['CREDITS_VIEW_ALL']}><CreditSimulator /></ProtectedRoute>} />
              <Route path="/simulator" element={<Navigate to="/credit-calculator" replace />} />
              <Route path="/settings" element={<ProtectedRoute allowedRoles={['admin']}><Settings /></ProtectedRoute>} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/audit-log" element={<ProtectedRoute allowedRoles={['admin', 'employee']} requiredPermissions={['AUDIT_VIEW_ALL']}><AuditLogPage /></ProtectedRoute>} />
              <Route path="*" element={<RoleHomeRedirect />} />
            </Routes>
          </React.Suspense>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <>
      <Toaster
        position="top-center"
        options={{
          fill: "#f5f5f5",
          roundness: 16,
          styles: {
            title: "text-gray-900!",
            description: "text-gray-600!",
          },
        }}
      />
      <React.Suspense fallback={<RouteLoadingFallback />}>
        <Routes>
          <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          />
        </Routes>
      </React.Suspense>
    </>
  );
}
