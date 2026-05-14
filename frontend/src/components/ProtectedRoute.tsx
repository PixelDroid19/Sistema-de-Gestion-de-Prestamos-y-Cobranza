import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Loader2, RotateCcw } from 'lucide-react';
import { apiClient, restoreAccessToken } from '../api/client';
import { getDefaultRouteForUser } from '../constants/appAccess';
import { useSessionStore } from '../store/sessionStore';
import { extractStatusCode } from '../services/safeErrorMessages';
import { ActionButton, SectionSurface } from './shared/Surfaces';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: ('admin' | 'employee' | 'customer' | 'socio')[];
  requiredPermissions?: string[];
}

interface GuestRouteProps {
  children: React.ReactNode;
}

const SessionLoadingState = ({ label = 'Restaurando sesión…' }: { label?: string }) => (
  <div className="flex h-screen w-full items-center justify-center bg-bg-base">
    <SectionSurface className="flex flex-col items-center gap-4 px-6 py-8">
      <Loader2 className="size-10 animate-spin text-brand-primary" />
      <p className="text-sm font-medium text-text-secondary">{label}</p>
    </SectionSurface>
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
    <SectionSurface className="w-full max-w-md">
      <div className="mb-4 flex items-start gap-3">
        <div className="mt-0.5 rounded-2xl bg-red-50 p-2 text-red-600">
          <AlertCircle className="size-5" />
        </div>
        <div className="space-y-1">
          <h1 className="text-lg font-semibold text-text-primary">No se pudo restaurar la sesión</h1>
          <p className="text-sm leading-6 text-text-secondary">
            La conexión se interrumpió o la sesión ya no es válida. Reintenta la restauración o vuelve al acceso.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <ActionButton
          type="button"
          onClick={onRetry}
          icon={<RotateCcw className="size-4" />}
          fullWidth
        >
          Reintentar
        </ActionButton>
        <ActionButton
          type="button"
          onClick={onExit}
          variant="primary"
          fullWidth
        >
          Volver al acceso
        </ActionButton>
      </div>
    </SectionSurface>
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

const extractPermissionNames = (payload: unknown): string[] => {
  const records = (payload as any)?.data?.permissions ?? (payload as any)?.data?.permissionNames ?? [];
  if (!Array.isArray(records)) return [];

  return records
    .map((entry) => {
      if (typeof entry === 'string') return entry;
      return entry?.permissionName ?? entry?.permission ?? entry?.name;
    })
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
};

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles, requiredPermissions = [] }) => {
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

  const permissionQuery = useQuery({
    queryKey: ['permissions.routeGuard', user?.id],
    queryFn: async () => {
      const { data } = await apiClient.get('/permissions/me');
      return data;
    },
    enabled: hasHydrated
      && Boolean(accessToken)
      && user?.role === 'employee'
      && requiredPermissions.length > 0,
    staleTime: 60_000,
    retry: false,
  });

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

  if (user.role === 'employee' && requiredPermissions.length > 0) {
    if (permissionQuery.isLoading) {
      return <SessionLoadingState label="Validando permisos…" />;
    }

    const grantedPermissions = new Set(extractPermissionNames(permissionQuery.data));
    const hasRequiredPermission = requiredPermissions.every((permission) => grantedPermissions.has(permission));
    if (!hasRequiredPermission) {
      return <Navigate to={getDefaultRouteForUser(user)} replace />;
    }
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
    return <SessionLoadingState label="Revisando tu acceso…" />;
  }

  if (accessToken && user) {
    return <Navigate to={getDefaultRouteForUser(user)} replace />;
  }

  return <>{children}</>;
};
