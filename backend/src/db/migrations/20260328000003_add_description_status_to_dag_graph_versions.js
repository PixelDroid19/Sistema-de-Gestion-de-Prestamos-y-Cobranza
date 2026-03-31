'use strict';

const { DataTypes } = require('sequelize');

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (t) => {
      await queryInterface.addColumn(
        'DagGraphVersions',
        'description',
        {
          type: DataTypes.STRING(500),
          allowNull: true,
        },
        { transaction: t }
      );

      await queryInterface.addColumn(
        'DagGraphVersions',
        'status',
        {
          type: DataTypes.STRING(20),
          allowNull: false,
          defaultValue: 'active',
        },
        { transaction: t }
      );
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (t) => {
      await queryInterface.removeColumn('DagGraphVersions', 'status', { transaction: t });
      await queryInterface.removeColumn('DagGraphVersions', 'description', { transaction: t });
    });
  },
};
