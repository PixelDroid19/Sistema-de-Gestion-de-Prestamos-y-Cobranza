import type { TranslationVars } from '../../i18n';
import { tTerm, type TermKey } from '../../i18n/terminology';

export type PermissionDisplayRecord = {
  permission: string;
  module: string;
  description?: string;
};

type Translate = (key: string, vars?: TranslationVars) => string;

const MODULE_DISPLAY_LABEL_KEYS: Record<string, TermKey> = {
  associates: 'permission.module.associates',
  auditoria: 'permission.module.audit',
  auditoría: 'permission.module.audit',
  audit: 'permission.module.audit',
  clientes: 'permission.module.customers',
  customers: 'permission.module.customers',
  creditos: 'permission.module.credits',
  credits: 'permission.module.credits',
  config: 'permission.module.config',
  dashboard: 'permission.module.dashboard',
  finanzas: 'permission.module.finances',
  general: 'permission.module.general',
  pagos: 'permission.module.payments',
  payments: 'permission.module.payments',
  permisos: 'permission.module.permissions',
  permissions: 'permission.module.permissions',
  reportes: 'permission.module.reports',
  reports: 'permission.module.reports',
  socios: 'permission.module.associates',
  usuarios: 'permission.module.users',
  users: 'permission.module.users',
};

const PERMISSION_ACTION_LABEL_KEYS: Record<string, string> = {
  READ: 'settings.employees.modal.permissions.actions.view',
  VIEW: 'settings.employees.modal.permissions.actions.view',
  CREATE: 'settings.employees.modal.permissions.actions.create',
  UPDATE: 'settings.employees.modal.permissions.actions.update',
  DELETE: 'settings.employees.modal.permissions.actions.delete',
  APPROVE: 'settings.employees.modal.permissions.actions.approve',
  REJECT: 'settings.employees.modal.permissions.actions.reject',
  EXPORT: 'settings.employees.modal.permissions.actions.export',
  GENERATE: 'settings.employees.modal.permissions.actions.generate',
  DEACTIVATE: 'settings.employees.modal.permissions.actions.deactivate',
  GRANT: 'settings.employees.modal.permissions.actions.grant',
  ASSIGN: 'settings.employees.modal.permissions.actions.assign',
  REVOKE: 'settings.employees.modal.permissions.actions.revoke',
  REVERSE: 'settings.employees.modal.permissions.actions.reverse',
  ANNUL: 'settings.employees.modal.permissions.actions.annul',
};

export const getPermissionModuleLabel = (module: string) => {
  const normalizedModule = module.trim().toLowerCase();
  return tTerm(MODULE_DISPLAY_LABEL_KEYS[normalizedModule] || 'permission.module.unknown');
};

export const getPermissionDisplayName = (permission: PermissionDisplayRecord, t: Translate) => {
  const description = permission.description?.trim();
  if (description) return description;

  const permissionTokens = permission.permission.toUpperCase().split('_').filter(Boolean);
  const actionToken = permissionTokens.find((token) => PERMISSION_ACTION_LABEL_KEYS[token]);
  const actionLabel = actionToken
    ? t(PERMISSION_ACTION_LABEL_KEYS[actionToken])
    : t('settings.employees.modal.permissions.actions.manage');
  const moduleLabel = getPermissionModuleLabel(permission.module).toLowerCase();

  return `${actionLabel} ${moduleLabel}`.trim();
};
