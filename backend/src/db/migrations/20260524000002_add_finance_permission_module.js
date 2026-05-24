'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query('ALTER TYPE "enum_Permissions_module" ADD VALUE IF NOT EXISTS \'FINANZAS\';');
  },

  async down() {
    // PostgreSQL does not support removing enum values safely when rows may reference them.
  },
};
