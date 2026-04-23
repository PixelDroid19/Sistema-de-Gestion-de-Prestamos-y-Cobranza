'use strict';

const { DataTypes } = require('sequelize');

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (t) => {
      // 1. Create DagVariables table
      await queryInterface.createTable('DagVariables', {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },
        name: {
          type: DataTypes.STRING,
          allowNull: false,
          unique: true,
        },
        type: {
          type: DataTypes.ENUM('integer', 'currency', 'boolean', 'percent'),
          allowNull: false,
        },
        source: {
          type: DataTypes.ENUM('bureau_api', 'app_data', 'system_core'),
          allowNull: false,
        },
        value: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        status: {
          type: DataTypes.ENUM('active', 'idle', 'deprecated'),
          defaultValue: 'active',
          allowNull: false,
        },
        description: {
          type: DataTypes.STRING(500),
          allowNull: true,
        },
        createdByUserId: {
          type: DataTypes.INTEGER,
          allowNull: true,
        },
        createdAt: {
          type: DataTypes.DATE,
          allowNull: false,
        },
        updatedAt: {
          type: DataTypes.DATE,
          allowNull: false,
        },
      }, { transaction: t });

      // 2. Add partial unique index on DagGraphVersions for active status
      // First remove the old non-unique index if it exists
      const indexes = await queryInterface.showIndex('DagGraphVersions', { transaction: t });
      const oldIndex = indexes.find((idx) => idx.name === 'dag_graph_versions_scope_key_status');
      if (oldIndex) {
        await queryInterface.removeIndex('DagGraphVersions', 'dag_graph_versions_scope_key_status', { transaction: t });
      }

      // Check if partial unique index already exists
      const existingPartial = indexes.find((idx) => idx.name === 'dag_graph_versions_scope_key_active_unique');
      if (!existingPartial) {
        await queryInterface.addIndex('DagGraphVersions', ['scopeKey', 'status'], {
          unique: true,
          where: { status: 'active' },
          name: 'dag_graph_versions_scope_key_active_unique',
          transaction: t,
        });
      }

      // 3. Reconcile duplicate active versions: keep only highest version active per scope
      const [duplicateRows] = await queryInterface.sequelize.query(
        `SELECT "scopeKey", MAX("version") as "maxVersion"
         FROM "DagGraphVersions"
         WHERE "status" = 'active'
         GROUP BY "scopeKey"
         HAVING COUNT(*) > 1`,
        { transaction: t }
      );

      for (const row of duplicateRows) {
        await queryInterface.sequelize.query(
          `UPDATE "DagGraphVersions"
           SET "status" = 'inactive'
           WHERE "scopeKey" = :scopeKey
             AND "status" = 'active'
             AND "version" < :maxVersion`,
          {
            replacements: { scopeKey: row.scopeKey, maxVersion: row.maxVersion },
            transaction: t,
          }
        );
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (t) => {
      await queryInterface.removeIndex('DagGraphVersions', 'dag_graph_versions_scope_key_active_unique', { transaction: t });
      await queryInterface.addIndex('DagGraphVersions', ['scopeKey', 'status'], {
        name: 'dag_graph_versions_scope_key_status',
        transaction: t,
      });
      await queryInterface.dropTable('DagVariables', { transaction: t });
    });
  },
};
