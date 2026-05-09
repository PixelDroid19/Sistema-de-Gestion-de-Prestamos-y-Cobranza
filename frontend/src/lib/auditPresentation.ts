import type { AuditLog } from '../services/auditService';

type HttpAuditContext = {
  method?: unknown;
  path?: unknown;
  service?: unknown;
};

const MODULE_LABELS: Record<string, string> = {
  credits: 'Créditos',
  customers: 'Clientes',
  payments: 'Pagos',
  associates: 'Socios',
  reports: 'Reportes',
  users: 'Usuarios',
  permissions: 'Permisos',
  config: 'Configuración',
  audit: 'Auditoría',
  auth: 'Autenticación',
};

const ACTION_LABELS: Record<string, string> = {
  CREATE: 'Creación',
  UPDATE: 'Actualización',
  DELETE: 'Eliminación',
  LOGIN: 'Inicio de sesión',
  LOGOUT: 'Cierre de sesión',
  APPROVE: 'Aprobación',
  REJECT: 'Rechazo',
  EXPORT: 'Exportación',
  IMPORT: 'Importación',
  PAYOFF: 'Pago total',
  RESTORE: 'Restauración',
};

const ENTITY_TYPE_LABELS: Record<string, string> = {
  Loan: 'Crédito',
  User: 'Usuario',
  Payment: 'Pago',
  Customer: 'Cliente',
  Associate: 'Socio',
  PromiseToPay: 'Compromiso de pago',
  Notification: 'Notificación',
  CalculationProfileVersion: 'Perfil de cálculo',
};

const ENTITY_TYPE_ALIASES: Record<string, string> = {
  credito: 'Loan',
  creditos: 'Loan',
  prestamo: 'Loan',
  prestamos: 'Loan',
  usuario: 'User',
  usuarios: 'User',
  pago: 'Payment',
  pagos: 'Payment',
  cliente: 'Customer',
  clientes: 'Customer',
  socio: 'Associate',
  socios: 'Associate',
  promesa: 'PromiseToPay',
  promesas: 'PromiseToPay',
  notificacion: 'Notification',
  notificaciones: 'Notification',
  formula: 'CalculationProfileVersion',
  formulas: 'CalculationProfileVersion',
};

const normalizeText = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLowerCase();

export const formatAuditDate = (dateStr: string) => new Date(dateStr).toLocaleString();

export const getAuditModuleLabel = (module: string) => MODULE_LABELS[module] || module;

export const getAuditActionLabel = (action: string) => ACTION_LABELS[action] || action;

export const getAuditEntityTypeLabel = (entityType?: string | null) => {
  if (!entityType) return 'Sin tipo';
  return ENTITY_TYPE_LABELS[entityType] || entityType;
};

export const formatAuditEntity = (log: Pick<AuditLog, 'entityType' | 'entityId'>) => {
  if (!log.entityType && !log.entityId) return 'Sin entidad';
  const label = getAuditEntityTypeLabel(log.entityType) || 'Entidad';
  return `${label}${log.entityId ? ` #${log.entityId}` : ''}`;
};

export const normalizeAuditEntityTypeInput = (value: string) => {
  const normalized = normalizeText(value);
  return ENTITY_TYPE_ALIASES[normalized] || value.trim();
};

export const getAuditActionTone = (action: string) => {
  switch (action) {
    case 'DELETE':
    case 'REJECT':
      return 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300';
    case 'CREATE':
    case 'APPROVE':
    case 'PAYOFF':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300';
    case 'UPDATE':
    case 'RESTORE':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300';
    case 'LOGIN':
    case 'LOGOUT':
      return 'bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-200';
    case 'EXPORT':
    case 'IMPORT':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300';
    default:
      return 'bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-200';
  }
};

export const getAuditHttpContext = (log: AuditLog): HttpAuditContext => {
  const metadata = log.metadata;
  const nestedHttp = metadata?.http;
  if (nestedHttp && typeof nestedHttp === 'object') {
    return nestedHttp as HttpAuditContext;
  }
  return {};
};

export const getAuditServiceLabel = (log: AuditLog) => {
  const http = getAuditHttpContext(log);
  const service = typeof http.service === 'string' ? http.service : null;
  const method = typeof http.method === 'string' ? http.method : null;
  const path = typeof http.path === 'string' ? http.path : null;

  if (service) return service;
  if (method && path) return `${method} ${path}`;
  if (path) return path;
  return getAuditModuleLabel(log.module);
};

export const getAuditMethod = (log: AuditLog) => {
  const method = getAuditHttpContext(log).method;
  return typeof method === 'string' ? method : null;
};

export const getAuditPath = (log: AuditLog) => {
  const path = getAuditHttpContext(log).path;
  return typeof path === 'string' ? path : null;
};
