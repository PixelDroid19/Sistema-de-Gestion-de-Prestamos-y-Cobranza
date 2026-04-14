export type AppUserLike = {
  role?: 'admin' | 'customer' | 'socio' | string;
  associateId?: number;
} | null | undefined;

/**
 * Resolve the safest landing route for the authenticated user.
 */
export const getDefaultRouteForUser = (user: AppUserLike): string => {
  if (user?.role === 'admin') {
    return '/dashboard';
  }

  if (user?.role === 'socio') {
    return Number.isFinite(Number(user.associateId))
      ? `/associates/${Number(user.associateId)}`
      : '/profile';
  }

  if (user?.role === 'customer') {
    return '/credits';
  }

  return '/login';
};
