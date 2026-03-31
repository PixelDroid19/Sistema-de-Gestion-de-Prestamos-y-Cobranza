'use strict';

const { DataTypes } = require('sequelize');

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (t) => {
      await queryInterface.addColumn(
        'Users',
        'failedLoginAttempts',
        {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        { transaction: t }
      );

      await queryInterface.addColumn(
        'Users',
        'lockedUntil',
        {
          type: DataTypes.DATE,
          allowNull: true,
        },
        { transaction: t }
      );
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (t) => {
      await queryInterface.removeColumn('Users', 'lockedUntil', { transaction: t });
      await queryInterface.removeColumn('Users', 'failedLoginAttempts', { transaction: t });
    });
  },
};
