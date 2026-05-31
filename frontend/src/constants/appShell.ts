import type { AppUserLike } from './appAccess';
import { PERMISSION } from './permissionNames';
import { tTerm, type TermKey } from '../i18n/terminology';

export const APP_BRAND = {
  name: 'CrediCobranza',
  workspace: 'Sistema de Préstamos',
  monogram: 'CC',
} as const;

export type ShellDestination = {
  view: string;
  label: string;
  description: string;
  roles: Array<'admin' | 'employee'>;
  permission?: string;
  permissions?: string[];
  keywords?: string[];
};

type ShellDestinationDefinition = Omit<ShellDestination, 'label' | 'description'> & {
  labelKey: TermKey;
  descriptionKey: TermKey;
};

const BASE_DESTINATIONS: ShellDestinationDefinition[] = [
  {
    view: 'dashboard',
    labelKey: 'shell.destination.dashboard.label',
    descriptionKey: 'shell.destination.dashboard.description',
    roles: ['admin', 'employee'],
    permission: PERMISSION.DASHBOARD_VIEW_ALL,
    keywords: ['inicio', 'resumen', 'kpi'],
  },
  {
    view: 'customers',
    labelKey: 'shell.destination.customers.label',
    descriptionKey: 'shell.destination.customers.description',
    roles: ['admin', 'employee'],
    permission: PERMISSION.CLIENTS_VIEW_ALL,
    keywords: ['personas', 'usuarios', 'clientes'],
  },
  {
    view: 'customers-new',
    labelKey: 'shell.destination.customersNew.label',
    descriptionKey: 'shell.destination.customersNew.description',
    roles: ['admin', 'employee'],
    permission: PERMISSION.CLIENTS_CREATE,
    keywords: ['alta cliente', 'crear cliente'],
  },
  {
    view: 'credits',
    labelKey: 'shell.destination.credits.label',
    descriptionKey: 'shell.destination.credits.description',
    roles: ['admin', 'employee'],
    permission: PERMISSION.CREDITS_VIEW_ALL,
    keywords: ['prestamos', 'cartera', 'cuotas'],
  },
  {
    view: 'credits-new',
    labelKey: 'shell.destination.creditsNew.label',
    descriptionKey: 'shell.destination.creditsNew.description',
    roles: ['admin', 'employee'],
    permissions: [PERMISSION.CREDITS_CREATE, PERMISSION.CREDITS_VIEW_ALL],
    keywords: ['crear credito', 'originacion', 'simular'],
  },
  {
    view: 'credit-calculator',
    labelKey: 'shell.destination.creditCalculator.label',
    descriptionKey: 'shell.destination.creditCalculator.description',
    roles: ['admin', 'employee'],
    permission: PERMISSION.CREDITS_VIEW_ALL,
    keywords: ['simulador', 'calculadora', 'cuota', 'perfil'],
  },
  {
    view: 'reports',
    labelKey: 'shell.destination.reports.label',
    descriptionKey: 'shell.destination.reports.description',
    roles: ['admin', 'employee'],
    permission: PERMISSION.REPORTS_VIEW_ALL,
    keywords: ['informes', 'metricas', 'exportes'],
  },
  {
    view: 'associates',
    labelKey: 'shell.destination.associates.label',
    descriptionKey: 'shell.destination.associates.description',
    roles: ['admin', 'employee'],
    permission: PERMISSION.SOCIOS_VIEW_ALL,
    keywords: ['inversionistas', 'aportantes'],
  },
  {
    view: 'payouts',
    labelKey: 'shell.destination.payouts.label',
    descriptionKey: 'shell.destination.payouts.description',
    roles: ['admin', 'employee'],
    permission: PERMISSION.PAYMENTS_VIEW_ALL,
    keywords: ['pagos', 'cobranza', 'recibos'],
  },
  {
    view: 'notifications',
    labelKey: 'shell.destination.notifications.label',
    descriptionKey: 'shell.destination.notifications.description',
    roles: ['admin', 'employee'],
    keywords: ['alertas', 'avisos', 'recordatorios'],
  },
  {
    view: 'audit-log',
    labelKey: 'shell.destination.auditLog.label',
    descriptionKey: 'shell.destination.auditLog.description',
    roles: ['admin', 'employee'],
    permission: PERMISSION.AUDIT_VIEW_ALL,
    keywords: ['historial', 'auditoria', 'cambios'],
  },
  {
    view: 'settings',
    labelKey: 'shell.destination.settings.label',
    descriptionKey: 'shell.destination.settings.description',
    roles: ['admin'],
    keywords: ['ajustes', 'tasas', 'mora'],
  },
  {
    view: 'profile',
    labelKey: 'shell.destination.profile.label',
    descriptionKey: 'shell.destination.profile.description',
    roles: ['admin', 'employee'],
    keywords: ['cuenta', 'perfil', 'usuario'],
  },
];

export const getShellDestinationsForUser = (user: AppUserLike): ShellDestination[] => {
  const role = user?.role;
  const permissionNames = new Set(
    Array.isArray(user?.permissions)
      ? user.permissions
        .map((entry) => typeof entry === 'string' ? entry : entry?.permission ?? entry?.permissionName ?? entry?.name)
        .filter((entry: unknown): entry is string => typeof entry === 'string')
      : [],
  );

  return BASE_DESTINATIONS.filter((item) => {
    if (!role || !item.roles.includes(role as 'admin' | 'employee')) {
      return false;
    }

    const requiredPermissions = item.permissions ?? (item.permission ? [item.permission] : []);

    if (role === 'admin' || requiredPermissions.length === 0) {
      return true;
    }

    return requiredPermissions.every((permission) => permissionNames.has(permission));
  }).map(({ labelKey, descriptionKey, ...item }) => {
    return {
      ...item,
      label: tTerm(labelKey),
      description: tTerm(descriptionKey),
    };
  });
};

export const getRoleLabel = (role?: 'admin' | 'employee' | string) => {
  if (role === 'admin') {
    return tTerm('role.admin');
  }

  if (role === 'employee') {
    return tTerm('role.employee');
  }

  return tTerm('role.unauthorized');
};
