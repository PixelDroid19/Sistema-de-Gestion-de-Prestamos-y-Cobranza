'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.addColumn('AuditLogs', 'category', {
        type: Sequelize.STRING(20),
        allowNull: true,
        defaultValue: null,
      }, { transaction });

      await queryInterface.addColumn('AuditLogs', 'severity', {
        type: Sequelize.STRING(10),
        allowNull: true,
        defaultValue: null,
      }, { transaction });

      await queryInterface.addIndex('AuditLogs', ['category'], {
        name: 'audit_logs_category',
        transaction,
      });
      await queryInterface.addIndex('AuditLogs', ['severity'], {
        name: 'audit_logs_severity',
        transaction,
      });

      await queryInterface.sequelize.query(`
        CREATE OR REPLACE FUNCTION audit_log_immutable()
        RETURNS TRIGGER AS $$
        BEGIN
          RAISE EXCEPTION 'Audit log records are immutable. UPDATE and DELETE are not allowed.';
          RETURN NULL;
        END;
        $$ LANGUAGE plpgsql;
      `, { transaction });

      await queryInterface.sequelize.query(`
        DROP TRIGGER IF EXISTS trg_audit_log_immutable ON "AuditLogs";
        CREATE TRIGGER trg_audit_log_immutable
        BEFORE UPDATE OR DELETE ON "AuditLogs"
        FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();
      `, { transaction });

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },

  async down(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query(
        'DROP TRIGGER IF EXISTS trg_audit_log_immutable ON "AuditLogs";',
        { transaction },
      );
      await queryInterface.sequelize.query(
        'DROP FUNCTION IF EXISTS audit_log_immutable();',
        { transaction },
      );

      await queryInterface.removeIndex('AuditLogs', 'audit_logs_severity', { transaction });
      await queryInterface.removeIndex('AuditLogs', 'audit_logs_category', { transaction });
      await queryInterface.removeColumn('AuditLogs', 'severity', { transaction });
      await queryInterface.removeColumn('AuditLogs', 'category', { transaction });

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },
};
