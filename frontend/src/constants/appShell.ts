import type { AppUserLike } from './appAccess';

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
  keywords?: string[];
};

const BASE_DESTINATIONS: ShellDestination[] = [
  {
    view: 'dashboard',
    label: 'Dashboard',
    description: 'Resumen operativo y métricas principales.',
    roles: ['admin', 'employee'],
    permission: 'DASHBOARD_VIEW_ALL',
    keywords: ['inicio', 'resumen', 'kpi'],
  },
  {
    view: 'customers',
    label: 'Clientes',
    description: 'Consulta y actualiza la base de clientes.',
    roles: ['admin', 'employee'],
    permission: 'CLIENTS_VIEW_ALL',
    keywords: ['personas', 'usuarios', 'clientes'],
  },
  {
    view: 'customers-new',
    label: 'Nuevo cliente',
    description: 'Registra un cliente nuevo en la cartera.',
    roles: ['admin', 'employee'],
    permission: 'CLIENTS_CREATE',
    keywords: ['alta cliente', 'crear cliente'],
  },
  {
    view: 'credits',
    label: 'Créditos vigentes',
    description: 'Portafolio, calendario y seguimiento de cobro.',
    roles: ['admin', 'employee'],
    permission: 'CREDITS_VIEW_ALL',
    keywords: ['prestamos', 'cartera', 'cuotas'],
  },
  {
    view: 'credits-new',
    label: 'Nuevo crédito',
    description: 'Simula y registra un crédito real.',
    roles: ['admin', 'employee'],
    permission: 'CREDITS_CREATE',
    keywords: ['crear credito', 'originacion', 'simular'],
  },
  {
    view: 'credit-calculator',
    label: 'Calcular crédito',
    description: 'Prueba la regla de cálculo activa antes de registrar.',
    roles: ['admin', 'employee'],
    permission: 'CREDITS_VIEW_ALL',
    keywords: ['simulador', 'calculadora', 'cuota', 'perfil'],
  },
  {
    view: 'reports',
    label: 'Reportes',
    description: 'Indicadores de cartera, mora y recaudo.',
    roles: ['admin', 'employee'],
    permission: 'REPORTS_VIEW_ALL',
    keywords: ['informes', 'metricas', 'exportes'],
  },
  {
    view: 'associates',
    label: 'Socios',
    description: 'Gestión administrativa de socios.',
    roles: ['admin', 'employee'],
    permission: 'SOCIOS_VIEW_ALL',
    keywords: ['inversionistas', 'aportantes'],
  },
  {
    view: 'payouts',
    label: 'Pagos y cobranza',
    description: 'Registro de desembolsos, pagos y comprobantes.',
    roles: ['admin', 'employee'],
    permission: 'PAYMENTS_VIEW_ALL',
    keywords: ['pagos', 'cobranza', 'recibos'],
  },
  {
    view: 'notifications',
    label: 'Notificaciones',
    description: 'Alertas operativas y seguimiento pendiente.',
    roles: ['admin', 'employee'],
    keywords: ['alertas', 'avisos', 'recordatorios'],
  },
  {
    view: 'audit-log',
    label: 'Auditoría',
    description: 'Trazabilidad de cambios y operaciones.',
    roles: ['admin', 'employee'],
    permission: 'AUDIT_VIEW_ALL',
    keywords: ['historial', 'auditoria', 'cambios'],
  },
  {
    view: 'settings',
    label: 'Configuración',
    description: 'Políticas del sistema, tasas y catálogos.',
    roles: ['admin'],
    keywords: ['ajustes', 'tasas', 'mora'],
  },
  {
    view: 'profile',
    label: 'Perfil',
    description: 'Datos de acceso y preferencias del usuario.',
    roles: ['admin', 'employee'],
    keywords: ['cuenta', 'perfil', 'usuario'],
  },
];

export const getShellDestinationsForUser = (user: AppUserLike): ShellDestination[] => {
  const role = user?.role;
  const permissionNames = new Set(
    Array.isArray((user as any)?.permissions)
      ? (user as any).permissions
        .map((entry: any) => typeof entry === 'string' ? entry : entry?.permission ?? entry?.name)
        .filter((entry: unknown): entry is string => typeof entry === 'string')
      : [],
  );

  return BASE_DESTINATIONS.filter((item) => {
    if (!role || !item.roles.includes(role as 'admin' | 'employee')) {
      return false;
    }

    if (role === 'admin' || !item.permission) {
      return true;
    }

    return permissionNames.has(item.permission);
  });
};

export const getRoleLabel = (role?: 'admin' | 'employee' | 'customer' | 'socio' | string) => {
  if (role === 'admin') {
    return 'Administrador';
  }

  if (role === 'employee') {
    return 'Empleado';
  }

  if (role === 'socio') {
    return 'Socio';
  }

  if (role === 'customer') {
    return 'Cliente';
  }

  return 'Usuario';
};
