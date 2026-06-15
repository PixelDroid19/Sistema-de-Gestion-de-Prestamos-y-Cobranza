import type { AuditLog } from '../services/auditService';
import { tTerm, type TermKey } from '../i18n/terminology';

type HttpAuditContext = {
  method?: unknown;
  path?: unknown;
  service?: unknown;
};

const MODULE_LABEL_KEYS: Record<string, TermKey> = {
  credits: 'audit.presentation.module.credits',
  customers: 'audit.presentation.module.customers',
  payments: 'audit.presentation.module.payments',
  associates: 'audit.presentation.module.associates',
  reports: 'audit.presentation.module.reports',
  users: 'audit.presentation.module.users',
  permissions: 'audit.presentation.module.permissions',
  config: 'audit.presentation.module.config',
  audit: 'audit.presentation.module.audit',
  auditoria: 'audit.presentation.module.audit',
  auth: 'audit.presentation.module.auth',
};

const ACTION_LABEL_KEYS: Record<string, TermKey> = {
  CREATE: 'audit.presentation.action.create',
  UPDATE: 'audit.presentation.action.update',
  DELETE: 'audit.presentation.action.delete',
  LOGIN: 'audit.presentation.action.login',
  LOGOUT: 'audit.presentation.action.logout',
  APPROVE: 'audit.presentation.action.approve',
  REJECT: 'audit.presentation.action.reject',
  EXPORT: 'audit.presentation.action.export',
  IMPORT: 'audit.presentation.action.import',
  PAYOFF: 'audit.presentation.action.payoff',
  RESTORE: 'audit.presentation.action.restore',
};

const EVENT_TYPE_LABEL_KEYS: Record<string, TermKey> = {
  'auth.login.success': 'audit.presentation.event.authLoginSuccess',
  'auth.login.failed': 'audit.presentation.event.authLoginFailed',
  'auth.account.locked': 'audit.presentation.event.authAccountLocked',
  'auth.logout': 'audit.presentation.event.authLogout',
  'auth.token.refreshed': 'audit.presentation.event.authTokenRefreshed',
  'auth.password.changed': 'audit.presentation.event.authPasswordChanged',
  'credit.created': 'audit.presentation.event.creditCreated',
  'credit.approved': 'audit.presentation.event.creditApproved',
  'credit.disbursed': 'audit.presentation.event.creditDisbursed',
  'credit.status.changed': 'audit.presentation.event.creditStatusChanged',
  'credit.closed': 'audit.presentation.event.creditClosed',
  'credit.installment.paid': 'audit.presentation.event.creditInstallmentPaid',
  'credit.installment.overdue': 'audit.presentation.event.creditInstallmentOverdue',
  'credit.capital_prepayment.applied': 'audit.presentation.event.creditCapitalPrepaymentApplied',
  'credit.payoff.completed': 'audit.presentation.event.creditPayoffCompleted',
  'credit.calculation_profile.changed': 'audit.presentation.event.creditCalculationProfileChanged',
  'payment.received': 'audit.presentation.event.paymentReceived',
  'payment.applied': 'audit.presentation.event.paymentApplied',
  'payment.rejected': 'audit.presentation.event.paymentRejected',
  'payment.reversed': 'audit.presentation.event.paymentReversed',
  'payment.voucher.generated': 'audit.presentation.event.paymentVoucherGenerated',
  'customer.created': 'audit.presentation.event.customerCreated',
  'customer.updated': 'audit.presentation.event.customerUpdated',
  'customer.deactivated': 'audit.presentation.event.customerDeactivated',
  'customer.reactivated': 'audit.presentation.event.customerReactivated',
  'customer.deleted': 'audit.presentation.event.customerDeleted',
  'associate.created': 'audit.presentation.event.associateCreated',
  'associate.updated': 'audit.presentation.event.associateUpdated',
  'associate.deleted': 'audit.presentation.event.associateDeleted',
  'associate.contribution.added': 'audit.presentation.event.associateContributionAdded',
  'associate.contribution.updated': 'audit.presentation.event.associateContributionUpdated',
  'associate.distribution.paid': 'audit.presentation.event.associateDistributionPaid',
  'associate.reinvestment.applied': 'audit.presentation.event.associateReinvestmentApplied',
  'associate.installment.recorded': 'audit.presentation.event.associateInstallmentRecorded',
  'config.rate_policy.created': 'audit.presentation.event.configRatePolicyCreated',
  'config.rate_policy.updated': 'audit.presentation.event.configRatePolicyUpdated',
  'config.rate_policy.deleted': 'audit.presentation.event.configRatePolicyDeleted',
  'config.late_fee_policy.changed': 'audit.presentation.event.configLateFeePolicyChanged',
  'config.payment_method.changed': 'audit.presentation.event.configPaymentMethodChanged',
  'config.setting.updated': 'audit.presentation.event.configSettingUpdated',
  'user.created': 'audit.presentation.event.userCreated',
  'user.updated': 'audit.presentation.event.userUpdated',
  'user.deactivated': 'audit.presentation.event.userDeactivated',
  'user.reactivated': 'audit.presentation.event.userReactivated',
  'user.unlocked': 'audit.presentation.event.userUnlocked',
  'user.permission.granted': 'audit.presentation.event.userPermissionGranted',
  'user.permission.revoked': 'audit.presentation.event.userPermissionRevoked',
  'notification.sent': 'audit.presentation.event.notificationSent',
  'notification.failed': 'audit.presentation.event.notificationFailed',
  'notification.overdue_alert.generated': 'audit.presentation.event.notificationOverdueAlertGenerated',
  'notification.overdue_alert.resolved': 'audit.presentation.event.notificationOverdueAlertResolved',
  'system.server.started': 'audit.presentation.event.systemServerStarted',
  'system.server.shutdown': 'audit.presentation.event.systemServerShutdown',
  'system.outbox.published': 'audit.presentation.event.systemOutboxPublished',
  'system.outbox.failed': 'audit.presentation.event.systemOutboxFailed',
  'system.schema.synced': 'audit.presentation.event.systemSchemaSynced',
  'system.rate_limit.exceeded': 'audit.presentation.event.systemRateLimitExceeded',
};

const CATEGORY_LABEL_KEYS: Record<string, TermKey> = {
  TECHNICAL: 'audit.presentation.category.technical',
  BUSINESS: 'audit.presentation.category.business',
  SECURITY: 'audit.presentation.category.security',
  AUDIT: 'audit.presentation.category.audit',
};

const ENTITY_TYPE_LABEL_KEYS: Record<string, TermKey> = {
  Loan: 'audit.presentation.entity.loan',
  User: 'audit.presentation.entity.user',
  Payment: 'audit.presentation.entity.payment',
  Customer: 'audit.presentation.entity.customer',
  Associate: 'audit.presentation.entity.associate',
  PromiseToPay: 'audit.presentation.entity.promiseToPay',
  Notification: 'audit.presentation.entity.notification',
  CalculationProfileVersion: 'audit.presentation.entity.calculationProfileVersion',
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

import { formatDateTime } from '../i18n/format';

export const formatAuditDate = (dateStr: string) => formatDateTime(dateStr) || '';

export const getAuditModuleLabel = (module: string) => tTerm(MODULE_LABEL_KEYS[normalizeText(module)] ?? 'audit.presentation.module.unknown');

export const getAuditActionLabel = (action: string) => tTerm(ACTION_LABEL_KEYS[action.trim().toUpperCase()] ?? 'audit.presentation.action.unknown');

export const getAuditEventTypeLabel = (eventType: string) => tTerm(EVENT_TYPE_LABEL_KEYS[eventType.trim().toLowerCase()] ?? 'audit.presentation.event.unknown');

export const getAuditCategoryLabel = (category: string) => tTerm(CATEGORY_LABEL_KEYS[category.trim().toUpperCase()] ?? 'audit.presentation.category.unknown');

export const getAuditEntityTypeLabel = (entityType?: string | null) => {
  if (!entityType) return tTerm('audit.presentation.entity.none');
  return tTerm(ENTITY_TYPE_LABEL_KEYS[entityType] ?? 'audit.presentation.entity.unknown');
};

export const formatAuditEntity = (log: Pick<AuditLog, 'entityType' | 'entityId'>) => {
  if (!log.entityType && !log.entityId) return tTerm('audit.presentation.entity.empty');
  return getAuditEntityTypeLabel(log.entityType) || tTerm('audit.presentation.entity.fallback');
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
