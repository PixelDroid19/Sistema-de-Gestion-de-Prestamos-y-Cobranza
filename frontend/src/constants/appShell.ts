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
  roles: Array<'admin' | 'customer' | 'socio'>;
  keywords?: string[];
};

const BASE_DESTINATIONS: ShellDestination[] = [
  {
    view: 'dashboard',
    label: 'Dashboard',
    description: 'Resumen operativo y métricas principales.',
    roles: ['admin'],
    keywords: ['inicio', 'resumen', 'kpi'],
  },
  {
    view: 'customers',
    label: 'Clientes',
    description: 'Consulta y actualiza la base de clientes.',
    roles: ['admin'],
    keywords: ['personas', 'usuarios', 'clientes'],
  },
  {
    view: 'customers-new',
    label: 'Nuevo cliente',
    description: 'Registra un cliente nuevo en la cartera.',
    roles: ['admin'],
    keywords: ['alta cliente', 'crear cliente'],
  },
  {
    view: 'credits',
    label: 'Créditos vigentes',
    description: 'Portafolio, calendario y seguimiento de cobro.',
    roles: ['admin', 'customer', 'socio'],
    keywords: ['prestamos', 'cartera', 'cuotas'],
  },
  {
    view: 'credits-new',
    label: 'Nuevo crédito',
    description: 'Simula y registra un crédito real.',
    roles: ['admin'],
    keywords: ['crear credito', 'originacion', 'simular'],
  },
  {
    view: 'credit-calculator',
    label: 'Calcular crédito',
    description: 'Prueba la fórmula activa antes de registrar.',
    roles: ['admin'],
    keywords: ['simulador', 'calculadora', 'cuota'],
  },
  {
    view: 'reports',
    label: 'Reportes',
    description: 'Indicadores de cartera, mora y recaudo.',
    roles: ['admin'],
    keywords: ['informes', 'metricas', 'exportes'],
  },
  {
    view: 'associates',
    label: 'Socios',
    description: 'Gestión administrativa de socios.',
    roles: ['admin', 'socio'],
    keywords: ['inversionistas', 'aportantes'],
  },
  {
    view: 'formulas',
    label: 'Fórmulas',
    description: 'Versiones activas y editor de fórmulas.',
    roles: ['admin'],
    keywords: ['dag', 'reglas', 'formula'],
  },
  {
    view: 'formulas/variables',
    label: 'Variables de fórmulas',
    description: 'Parámetros usados por las fórmulas activas.',
    roles: ['admin'],
    keywords: ['variables', 'parametros'],
  },
  {
    view: 'payouts',
    label: 'Pagos y cobranza',
    description: 'Registro de desembolsos, pagos y comprobantes.',
    roles: ['admin'],
    keywords: ['pagos', 'cobranza', 'recibos'],
  },
  {
    view: 'notifications',
    label: 'Notificaciones',
    description: 'Alertas operativas y seguimiento pendiente.',
    roles: ['admin', 'customer', 'socio'],
    keywords: ['alertas', 'avisos', 'recordatorios'],
  },
  {
    view: 'audit-log',
    label: 'Auditoría',
    description: 'Trazabilidad de cambios y operaciones.',
    roles: ['admin'],
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
    roles: ['admin', 'customer', 'socio'],
    keywords: ['cuenta', 'perfil', 'usuario'],
  },
];

export const getShellDestinationsForUser = (user: AppUserLike): ShellDestination[] => {
  const role = user?.role;

  const resolvedDestinations = BASE_DESTINATIONS
    .filter((item) => role && item.roles.includes(role as 'admin' | 'customer' | 'socio'));

  if (role === 'socio') {
    return resolvedDestinations.map((item) => {
      if (item.view !== 'associates') {
        return item;
      }

      const associateId = Number(user?.associateId);
      return {
        ...item,
        view: Number.isFinite(associateId) ? `associates/${associateId}` : 'profile',
        label: 'Mi portal de socio',
        description: 'Consulta aportes, rentabilidad y movimientos.',
      };
    });
  }

  return resolvedDestinations;
};

export const getRoleLabel = (role?: 'admin' | 'customer' | 'socio' | string) => {
  if (role === 'admin') {
    return 'Administrador';
  }

  if (role === 'socio') {
    return 'Socio';
  }

  if (role === 'customer') {
    return 'Cliente';
  }

  return 'Usuario';
};
