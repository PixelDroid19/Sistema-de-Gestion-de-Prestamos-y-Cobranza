/**
 * Store the interest terms that were active when each associate contribution was recorded.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('AssociateContributions', 'interestTypeSnapshot', {
      type: Sequelize.ENUM('monthly', 'annual'),
      allowNull: true,
    });
    await queryInterface.addColumn('AssociateContributions', 'interestRateSnapshot', {
      type: Sequelize.DECIMAL(7, 4),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('AssociateContributions', 'interestRateSnapshot');
    await queryInterface.removeColumn('AssociateContributions', 'interestTypeSnapshot');
  },
};
