'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('AssociateContributions', 'status', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'completed',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('AssociateContributions', 'status');
  },
};
