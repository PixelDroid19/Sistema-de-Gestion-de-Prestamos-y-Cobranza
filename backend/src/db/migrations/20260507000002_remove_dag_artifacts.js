'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_name = 'Loans'
              AND column_name = 'dagGraphVersionId'
          ) THEN
            UPDATE "Loans" AS loan
            SET "policySnapshot" = jsonb_set(
              COALESCE(loan."policySnapshot", '{}'::jsonb),
              '{retiredCalculationTrace}',
              jsonb_strip_nulls(jsonb_build_object(
                'source', 'retired_graph',
                'graphVersionId', loan."dagGraphVersionId",
                'capturedAt', NOW()
              )),
              true
            )
            WHERE loan."dagGraphVersionId" IS NOT NULL;
          END IF;
        END $$;
      `, { transaction });

      await queryInterface.sequelize.query(`
        ALTER TABLE "Loans"
        DROP CONSTRAINT IF EXISTS "Loans_dagGraphVersionId_fkey";
      `, { transaction });

      await queryInterface.sequelize.query(`
        DROP INDEX IF EXISTS "Loans_dagGraphVersionId_idx";
        DROP INDEX IF EXISTS "loans_dag_graph_version_id";
      `, { transaction });

      await queryInterface.sequelize.query(`
        ALTER TABLE "Loans"
        DROP COLUMN IF EXISTS "dagGraphVersionId";
      `, { transaction });

      await queryInterface.sequelize.query('DROP TABLE IF EXISTS "DagSimulationSummaries" CASCADE;', { transaction });
      await queryInterface.sequelize.query('DROP TABLE IF EXISTS "DagVariables" CASCADE;', { transaction });
      await queryInterface.sequelize.query('DROP TABLE IF EXISTS "DagGraphVersions" CASCADE;', { transaction });
    });
  },

  async down(queryInterface, Sequelize) {
    const { DataTypes } = Sequelize;

    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable('DagGraphVersions', {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        scopeKey: { type: DataTypes.STRING, allowNull: false },
        name: { type: DataTypes.STRING, allowNull: false, defaultValue: 'Restored Historical Formula Graph' },
        description: { type: DataTypes.STRING(500), allowNull: true },
        version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
        status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'inactive' },
        graph: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
        graphSummary: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
        validation: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
        createdByUserId: { type: DataTypes.INTEGER, allowNull: true },
        commitMessage: { type: DataTypes.STRING(500), allowNull: true },
        authorName: { type: DataTypes.STRING, allowNull: true },
        authorEmail: { type: DataTypes.STRING, allowNull: true },
        restoredFromVersionId: { type: DataTypes.INTEGER, allowNull: true },
        createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
        updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      }, { transaction });

      await queryInterface.addColumn('Loans', 'dagGraphVersionId', {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'DagGraphVersions', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      }, { transaction });
    });
  },
};
