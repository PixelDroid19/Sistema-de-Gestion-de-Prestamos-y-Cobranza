export const AUDIT_MODULES = ['credits', 'customers', 'payments', 'associates', 'reports', 'users', 'permissions', 'config', 'audit', 'auth'] as const;
export const AUDIT_ACTIONS = ['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'APPROVE', 'REJECT', 'EXPORT', 'IMPORT', 'PAYOFF', 'RESTORE'] as const;
export const AUDIT_CATEGORIES = ['TECHNICAL', 'BUSINESS', 'SECURITY', 'AUDIT'] as const;
export const AUDIT_SEVERITIES = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'CRITICAL'] as const;

export type AuditModule = typeof AUDIT_MODULES[number];
export type AuditAction = typeof AUDIT_ACTIONS[number];
export type AuditCategory = typeof AUDIT_CATEGORIES[number];
export type AuditSeverity = typeof AUDIT_SEVERITIES[number];

export interface AuditStreamEvent {
  eventType: string;
  category: AuditCategory;
  severity: AuditSeverity;
  timestamp: string;
  requestId?: string;
  traceId?: string;
  userId?: number;
  userRole?: string;
  ip?: string;
  data?: Record<string, unknown>;
}
