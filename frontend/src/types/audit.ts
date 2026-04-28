export const AUDIT_MODULES = ['credits', 'customers', 'payments', 'associates', 'reports', 'users', 'permissions', 'config', 'audit', 'auth'] as const;
export const AUDIT_ACTIONS = ['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'APPROVE', 'REJECT', 'EXPORT', 'IMPORT', 'PAYOFF', 'RESTORE'] as const;

export type AuditModule = typeof AUDIT_MODULES[number];
export type AuditAction = typeof AUDIT_ACTIONS[number];
