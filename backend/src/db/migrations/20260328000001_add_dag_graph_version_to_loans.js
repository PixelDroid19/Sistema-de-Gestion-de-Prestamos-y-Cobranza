'use strict';

const { DataTypes } = require('sequelize');

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (t) => {
      await queryInterface.addColumn(
        'Loans',
        'dagGraphVersionId',
        {
          type: DataTypes.INTEGER,
          allowNull: true,
          references: {
            model: 'DagGraphVersions',
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        { transaction: t }
      );
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (t) => {
      await queryInterface.removeColumn('Loans', 'dagGraphVersionId', { transaction: t });
    });
  },
};
