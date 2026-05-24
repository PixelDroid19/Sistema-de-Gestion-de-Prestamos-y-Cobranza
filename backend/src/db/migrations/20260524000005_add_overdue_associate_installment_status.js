'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query('ALTER TYPE "enum_AssociateInstallments_status" ADD VALUE IF NOT EXISTS \'overdue\';');
  },

  async down() {
    // PostgreSQL enum values cannot be removed safely while historical rows may reference them.
  },
};
