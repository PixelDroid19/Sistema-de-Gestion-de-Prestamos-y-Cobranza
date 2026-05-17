/**
 * Centralized permission name constants.
 * Matches backend permission catalog from backend/src/db/seeds/permissions_catalog.js
 */
export const PERMISSION = {
  // Dashboard
  DASHBOARD_VIEW_ALL: 'DASHBOARD_VIEW_ALL',

  // Clients
  CLIENTS_VIEW_ALL: 'CLIENTS_VIEW_ALL',
  CLIENTS_CREATE: 'CLIENTS_CREATE',
  CLIENTS_UPDATE: 'CLIENTS_UPDATE',
  CLIENTS_DELETE: 'CLIENTS_DELETE',

  // Credits
  CREDITS_VIEW_ALL: 'CREDITS_VIEW_ALL',
  CREDITS_CREATE: 'CREDITS_CREATE',
  CREDITS_UPDATE: 'CREDITS_UPDATE',

  // Payments
  PAYMENTS_VIEW_ALL: 'PAYMENTS_VIEW_ALL',
  PAYMENTS_CREATE: 'PAYMENTS_CREATE',

  // Associates (Socios)
  SOCIOS_VIEW_ALL: 'SOCIOS_VIEW_ALL',
  SOCIOS_CREATE: 'SOCIOS_CREATE',
  SOCIOS_UPDATE: 'SOCIOS_UPDATE',
  SOCIOS_DELETE: 'SOCIOS_DELETE',

  // Reports
  REPORTS_VIEW_ALL: 'REPORTS_VIEW_ALL',

  // Audit
  AUDIT_VIEW_ALL: 'AUDIT_VIEW_ALL',
} as const;

export type PermissionName = typeof PERMISSION[keyof typeof PERMISSION];
