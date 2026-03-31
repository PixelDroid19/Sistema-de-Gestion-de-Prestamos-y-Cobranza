'use strict';

const { DataTypes } = require('sequelize');

const AUDIT_MODULES = ['CREDITOS', 'CLIENTES', 'PAGOS', 'SOCIOS', 'REPORTES', 'USUARIOS', 'PERMISOS', 'AUDITORÍA', 'AUTH'];
const AUDIT_ACTIONS = ['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'APPROVE', 'REJECT', 'EXPORT', 'IMPORT'];

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (t) => {
      await queryInterface.createTable(
        'AuditLogs',
        {
          id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
          },
          userId: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
              model: 'Users',
              key: 'id',
            },
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL',
          },
          userName: {
            type: DataTypes.STRING,
            allowNull: true,
          },
          action: {
            type: DataTypes.ENUM(...AUDIT_ACTIONS),
            allowNull: false,
          },
          module: {
            type: DataTypes.ENUM(...AUDIT_MODULES),
            allowNull: false,
          },
          entityId: {
            type: DataTypes.STRING,
            allowNull: true,
          },
          entityType: {
            type: DataTypes.STRING,
            allowNull: true,
          },
          previousData: {
            type: DataTypes.JSONB,
            allowNull: true,
          },
          newData: {
            type: DataTypes.JSONB,
            allowNull: true,
          },
          metadata: {
            type: DataTypes.JSONB,
            allowNull: true,
          },
          ip: {
            type: DataTypes.STRING,
            allowNull: true,
          },
          userAgent: {
            type: DataTypes.STRING,
            allowNull: true,
          },
          timestamp: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
          },
          createdAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
          },
          updatedAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
          },
        },
        {
          transaction: t,
          indexes: [
            { fields: ['userId', 'timestamp'], transaction: t },
            { fields: ['module', 'action'], transaction: t },
            { fields: ['entityId', 'entityType'], transaction: t },
            { fields: ['timestamp'], transaction: t },
          ],
        }
      );
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (t) => {
      await queryInterface.dropTable('AuditLogs', { transaction: t });
    });
  },
};
