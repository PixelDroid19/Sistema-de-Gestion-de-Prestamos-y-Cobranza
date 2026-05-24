'use strict';

const { DataTypes } = require('sequelize');

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable('OperatingExpenses', {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        amount: { type: DataTypes.FLOAT, allowNull: false },
        expenseDate: { type: DataTypes.DATE, allowNull: false },
        category: { type: DataTypes.STRING, allowNull: false },
        description: { type: DataTypes.STRING, allowNull: false },
        status: {
          type: DataTypes.ENUM('completed', 'annulled'),
          allowNull: false,
          defaultValue: 'completed',
        },
        paymentMethod: { type: DataTypes.STRING, allowNull: true },
        reference: { type: DataTypes.STRING, allowNull: true },
        notes: { type: DataTypes.TEXT, allowNull: true },
        createdByUserId: {
          type: DataTypes.INTEGER,
          allowNull: true,
          references: { model: 'Users', key: 'id' },
          onDelete: 'SET NULL',
          onUpdate: 'CASCADE',
        },
        annulledAt: { type: DataTypes.DATE, allowNull: true },
        annulledByUserId: {
          type: DataTypes.INTEGER,
          allowNull: true,
          references: { model: 'Users', key: 'id' },
          onDelete: 'SET NULL',
          onUpdate: 'CASCADE',
        },
        annulmentReason: { type: DataTypes.TEXT, allowNull: true },
        createdAt: { type: DataTypes.DATE, allowNull: false },
        updatedAt: { type: DataTypes.DATE, allowNull: false },
      }, { transaction });

      await queryInterface.addIndex('OperatingExpenses', ['expenseDate'], {
        name: 'operating_expenses_expense_date',
        transaction,
      });
      await queryInterface.addIndex('OperatingExpenses', ['status'], {
        name: 'operating_expenses_status',
        transaction,
      });
      await queryInterface.addIndex('OperatingExpenses', ['createdByUserId'], {
        name: 'operating_expenses_created_by_user_id',
        transaction,
      });
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.dropTable('OperatingExpenses', { transaction });
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_OperatingExpenses_status";', { transaction });
    });
  },
};
