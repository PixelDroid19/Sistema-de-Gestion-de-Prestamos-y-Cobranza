const { DataTypes } = require('sequelize');
const sequelize = require('./database');
const { LOG_CATEGORY, LOG_SEVERITY } = require('@/modules/shared/logCategories');

const AUDIT_MODULES = ['CREDITOS', 'CLIENTES', 'PAGOS', 'SOCIOS', 'REPORTES', 'FINANZAS', 'USUARIOS', 'PERMISOS', 'CONFIGURACION', 'AUDITORÍA', 'AUTH', 'SISTEMA', 'NOTIFICACIONES'];
const AUDIT_ACTIONS = ['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'APPROVE', 'REJECT', 'EXPORT', 'IMPORT', 'PAYOFF', 'RESTORE'];
const AUDIT_CATEGORIES = Object.values(LOG_CATEGORY);
const AUDIT_SEVERITIES = Object.values(LOG_SEVERITY);

const AuditLog = sequelize.define('AuditLog', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId: { type: DataTypes.INTEGER, allowNull: true },
  userName: { type: DataTypes.STRING, allowNull: true },
  action: { type: DataTypes.ENUM(...AUDIT_ACTIONS), allowNull: false },
  module: { type: DataTypes.ENUM(...AUDIT_MODULES), allowNull: false },
  category: { type: DataTypes.ENUM(...AUDIT_CATEGORIES), allowNull: true, defaultValue: null },
  severity: { type: DataTypes.ENUM(...AUDIT_SEVERITIES), allowNull: true, defaultValue: null },
  entityId: { type: DataTypes.STRING, allowNull: true },
  entityType: { type: DataTypes.STRING, allowNull: true },
  previousData: { type: DataTypes.JSONB, allowNull: true },
  newData: { type: DataTypes.JSONB, allowNull: true },
  metadata: { type: DataTypes.JSONB, allowNull: true },
  ip: { type: DataTypes.STRING, allowNull: true },
  userAgent: { type: DataTypes.STRING, allowNull: true },
}, {
  timestamps: true,
  createdAt: 'timestamp',
  updatedAt: false,
  indexes: [
    { fields: ['userId', 'timestamp'] },
    { fields: ['module', 'action'] },
    { fields: ['entityId', 'entityType'] },
    { fields: ['timestamp'] },
    { fields: ['category'] },
    { fields: ['severity'] },
  ],
});

module.exports = AuditLog;
module.exports.AUDIT_MODULES = AUDIT_MODULES;
module.exports.AUDIT_ACTIONS = AUDIT_ACTIONS;
module.exports.AUDIT_CATEGORIES = AUDIT_CATEGORIES;
module.exports.AUDIT_SEVERITIES = AUDIT_SEVERITIES;
