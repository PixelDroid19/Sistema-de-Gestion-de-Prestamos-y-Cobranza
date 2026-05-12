/**
 * Add explicit financial terms for socios and richer interest-payment trace fields.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Associates', 'interestType', {
      type: Sequelize.ENUM('monthly', 'annual'),
      allowNull: false,
      defaultValue: 'monthly',
    });
    await queryInterface.addColumn('Associates', 'interestRate', {
      type: Sequelize.DECIMAL(7, 4),
      allowNull: false,
      defaultValue: 0,
    });
    await queryInterface.addColumn('Associates', 'interestPaymentDay', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 1,
    });
    await queryInterface.addColumn('Associates', 'interestPaymentMonth', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await queryInterface.addColumn('Associates', 'interestStartsAt', {
      type: Sequelize.DATEONLY,
      allowNull: true,
    });

    await queryInterface.addColumn('AssociateInstallments', 'capitalBase', {
      type: Sequelize.FLOAT,
      allowNull: true,
    });
    await queryInterface.addColumn('AssociateInstallments', 'interestRate', {
      type: Sequelize.DECIMAL(7, 4),
      allowNull: true,
    });
    await queryInterface.addColumn('AssociateInstallments', 'interestType', {
      type: Sequelize.ENUM('monthly', 'annual'),
      allowNull: true,
    });
    await queryInterface.addColumn('AssociateInstallments', 'periodStartDate', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addColumn('AssociateInstallments', 'periodEndDate', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addColumn('AssociateInstallments', 'paymentMethod', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('AssociateInstallments', 'notes', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('AssociateInstallments', 'notes');
    await queryInterface.removeColumn('AssociateInstallments', 'paymentMethod');
    await queryInterface.removeColumn('AssociateInstallments', 'periodEndDate');
    await queryInterface.removeColumn('AssociateInstallments', 'periodStartDate');
    await queryInterface.removeColumn('AssociateInstallments', 'interestType');
    await queryInterface.removeColumn('AssociateInstallments', 'interestRate');
    await queryInterface.removeColumn('AssociateInstallments', 'capitalBase');

    await queryInterface.removeColumn('Associates', 'interestStartsAt');
    await queryInterface.removeColumn('Associates', 'interestPaymentMonth');
    await queryInterface.removeColumn('Associates', 'interestPaymentDay');
    await queryInterface.removeColumn('Associates', 'interestRate');
    await queryInterface.removeColumn('Associates', 'interestType');
  },
};
