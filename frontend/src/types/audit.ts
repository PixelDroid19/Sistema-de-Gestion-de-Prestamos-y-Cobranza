export const AUDIT_MODULES = ['CREDITOS', 'CLIENTES', 'PAGOS', 'SOCIOS', 'REPORTES', 'USUARIOS', 'PERMISOS', 'AUDITORÍA', 'AUTH'] as const;
export const AUDIT_ACTIONS = ['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'APPROVE', 'REJECT', 'EXPORT', 'IMPORT'] as const;

export type AuditModule = typeof AUDIT_MODULES[number];
export type AuditAction = typeof AUDIT_ACTIONS[number];
