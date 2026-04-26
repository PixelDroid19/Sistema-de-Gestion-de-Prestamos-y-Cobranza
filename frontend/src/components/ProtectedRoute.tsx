import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Loader2, RotateCcw } from 'lucide-react';
import { restoreAccessToken } from '../api/client';
import { getDefaultRouteForUser } from '../constants/appAccess';
import { useSessionStore } from '../store/sessionStore';
import { extractStatusCode } from '../services/safeErrorMessages';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: ('admin' | 'customer' | 'socio')[];
}

interface GuestRouteProps {
  children: React.ReactNode;
}

const SessionLoadingState = ({ label = 'Restaurando sesión...' }: { label?: string }) => (
  <div className="flex h-screen w-full items-center justify-center bg-bg-base">
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-border-subtle bg-bg-surface px-6 py-8 shadow-sm">
      <Loader2 className="h-10 w-10 animate-spin text-brand-primary" />
      <p className="text-sm font-medium text-text-secondary">{label}</p>
    </div>
  </div>
);

const SessionRestoreErrorState = ({
  onRetry,
  onExit,
}: {
  onRetry: () => void;
  onExit: () => void;
}) => (
  <div className="flex h-screen w-full items-center justify-center bg-bg-base px-4">
    <div className="w-full max-w-md rounded-3xl border border-border-subtle bg-bg-surface p-6 shadow-sm">
      <div className="mb-4 flex items-start gap-3">
        <div className="mt-0.5 rounded-2xl bg-red-50 p-2 text-red-600">
          <AlertCircle className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <h1 className="text-lg font-semibold text-text-primary">No se pudo restaurar la sesión</h1>
          <p className="text-sm leading-6 text-text-secondary">
            La conexión se interrumpió o la sesión ya no es válida. Reintenta la restauración o vuelve al acceso.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-border-subtle bg-bg-surface px-4 py-2.5 text-sm font-medium text-text-primary transition hover:bg-hover-bg"
        >
          <RotateCcw className="h-4 w-4" />
          Reintentar
        </button>
        <button
          type="button"
          onClick={onExit}
          className="inline-flex flex-1 items-center justify-center rounded-xl bg-text-primary px-4 py-2.5 text-sm font-semibold text-bg-base transition hover:opacity-90"
        >
          Volver al acceso
        </button>
      </div>
    </div>
  </div>
);

const useResolvedSession = () => {
  const { user, accessToken, refreshToken, hasHydrated, logout } = useSessionStore();

  const restoreQuery = useQuery({
    queryKey: ['auth.restoreSession', refreshToken],
    queryFn: restoreAccessToken,
    enabled: hasHydrated && !accessToken && !!refreshToken,
    retry: false,
    staleTime: Infinity,
  });

  const isRestoring = hasHydrated && !accessToken && !!refreshToken && restoreQuery.isLoading;
  const restoreError = hasHydrated && !accessToken && !!refreshToken ? restoreQuery.error : null;
  const restoreErrorStatus = extractStatusCode(restoreError);

  return {
    user,
    accessToken,
    refreshToken,
    hasHydrated,
    logout,
    isRestoring,
    restoreError,
    restoreErrorStatus,
    retryRestore: () => {
      void restoreQuery.refetch();
    },
  };
};

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const location = useLocation();
  const {
    user,
    accessToken,
    refreshToken,
    hasHydrated,
    logout,
    isRestoring,
    restoreError,
    restoreErrorStatus,
    retryRestore,
  } = useResolvedSession();

  if (!hasHydrated || isRestoring) {
    return <SessionLoadingState />;
  }

  if (restoreError && refreshToken && !accessToken) {
    if (restoreErrorStatus === 401) {
      logout();
      return <Navigate to="/login" state={{ from: location }} replace />;
    }

    return (
      <SessionRestoreErrorState
        onRetry={retryRestore}
        onExit={() => {
          logout();
        }}
      />
    );
  }

  if (!accessToken || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={getDefaultRouteForUser(user)} replace />;
  }

  return <>{children}</>;
};

export const GuestRoute: React.FC<GuestRouteProps> = ({ children }) => {
  const {
    user,
    accessToken,
    refreshToken,
    hasHydrated,
    isRestoring,
  } = useResolvedSession();

  if (!hasHydrated || (refreshToken && !accessToken && isRestoring)) {
    return <SessionLoadingState label="Revisando tu acceso..." />;
  }

  if (accessToken && user) {
    return <Navigate to={getDefaultRouteForUser(user)} replace />;
  }

  return <>{children}</>;
};
