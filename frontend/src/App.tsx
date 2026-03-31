/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Toaster } from './lib/toast';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import Customers from './components/Customers';
import CustomerDetails from './components/CustomerDetails';
import NewCustomer from './components/NewCustomer';
import Credits from './components/Credits';
import NewCredit from './components/NewCredit';
import CreditDetails from './components/CreditDetails';
import Associates from './components/Associates';
import AssociateDetails from './components/AssociateDetails';
import Payouts from './components/Payouts';
import Notifications from './components/Notifications';
import Reports from './components/Reports';
import Settings from './components/Settings';
import Profile from './components/Profile';
import Login from './components/Login';
import AuditLogPage from './components/AuditLogPage';
import { ProtectedRoute } from './components/ProtectedRoute';

function MainLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentView = location.pathname.substring(1) || 'dashboard';

  const setCurrentView = (view: string) => {
    navigate(`/${view}`);
  };

  return (
    <div className="flex h-screen w-full bg-bg-base text-text-primary overflow-hidden font-sans">
      <Sidebar currentView={currentView} setCurrentView={setCurrentView} />
      <div className="flex flex-col flex-1 min-w-0">
        <Header setCurrentView={setCurrentView} />
        <main className="flex-1 overflow-y-auto p-6 bg-bg-base">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/customers" element={<Customers setCurrentView={setCurrentView} />} />
            <Route path="/customers/:id" element={<CustomerDetails />} />
            <Route path="/customers-new" element={<NewCustomer onBack={() => setCurrentView('customers')} />} />
            <Route path="/credits" element={<Credits setCurrentView={setCurrentView} />} />
            <Route path="/credits-new" element={<NewCredit onBack={() => setCurrentView('credits')} />} />
            <Route path="/new-credit" element={<Navigate to="/credits-new" replace />} />
            <Route path="/credits/:id" element={<CreditDetails />} />
            <Route path="/associates" element={<Associates setCurrentView={setCurrentView} />} />
            <Route path="/associates/:id" element={<AssociateDetails />} />
            <Route path="/payouts" element={<Payouts />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/audit-log" element={<AuditLogPage />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
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
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        />
      </Routes>
    </>
  );
}
