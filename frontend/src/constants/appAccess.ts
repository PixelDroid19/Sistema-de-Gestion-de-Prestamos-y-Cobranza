export type AppUserLike = {
  role?: 'admin' | 'employee' | 'customer' | 'socio' | string;
  associateId?: number;
  permissions?: Array<string | { permission?: string; permissionName?: string; name?: string }>;
} | null | undefined;

/**
 * Resolve the safest landing route for the authenticated user.
 */
export const getDefaultRouteForUser = (user: AppUserLike): string => {
  if (user?.role === 'admin') {
    return '/dashboard';
  }

  if (user?.role === 'employee') {
    return '/profile';
  }

  return '/login';
};
