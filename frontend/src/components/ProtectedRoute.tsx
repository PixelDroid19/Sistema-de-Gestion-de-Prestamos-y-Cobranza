import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSessionStore } from '../store/sessionStore';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { getDefaultRouteForUser } from '../constants/appAccess';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: ('admin' | 'customer' | 'socio')[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { user, accessToken, refreshToken, updateAccessToken, logout } = useSessionStore();
  const location = useLocation();

  // Si no hay accessToken pero sí hay refreshToken, intentamos restaurar la sesión
  const { isLoading, isError, isSuccess } = useQuery({
    queryKey: ['auth.restoreSession'],
    queryFn: async () => {
      try {
        const response = await apiClient.post('/auth/refresh', { refreshToken });
        const newAccessToken = response.data.data.accessToken;
        const newRefreshToken = response.data.data.refreshToken;
        updateAccessToken(newAccessToken, newRefreshToken);
        return newAccessToken;
      } catch (error) {
        logout();
        throw error;
      }
    },
    enabled: !accessToken && !!refreshToken,
    retry: false,
    staleTime: Infinity,
  });

  // Si estamos intentando restaurar la sesión, mostramos un estado de carga
  if (!accessToken && !!refreshToken && isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-bg-base">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-brand-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-text-secondary font-medium">Restaurando sesión...</p>
        </div>
      </div>
    );
  }

  // Si no hay token de acceso ni refresh token (o si falló la restauración)
  if (!accessToken || !user) {
    // Redirigir a login
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Verificar permisos basados en roles
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={getDefaultRouteForUser(user)} replace />;
  }

  return <>{children}</>;
};
