const { DataTypes } = require('sequelize');
const sequelize = require('./database');

const AUDIT_MODULES = ['CREDITOS', 'CLIENTES', 'PAGOS', 'SOCIOS', 'REPORTES', 'USUARIOS', 'PERMISOS', 'AUDITORÍA', 'AUTH'];
const AUDIT_ACTIONS = ['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'APPROVE', 'REJECT', 'EXPORT', 'IMPORT', 'PAYOFF', 'RESTORE'];

const AuditLog = sequelize.define('AuditLog', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId: { type: DataTypes.INTEGER, allowNull: true },
  userName: { type: DataTypes.STRING, allowNull: true },
  action: { type: DataTypes.ENUM(...AUDIT_ACTIONS), allowNull: false },
  module: { type: DataTypes.ENUM(...AUDIT_MODULES), allowNull: false },
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
  ],
});

module.exports = AuditLog;
module.exports.AUDIT_MODULES = AUDIT_MODULES;
module.exports.AUDIT_ACTIONS = AUDIT_ACTIONS;
