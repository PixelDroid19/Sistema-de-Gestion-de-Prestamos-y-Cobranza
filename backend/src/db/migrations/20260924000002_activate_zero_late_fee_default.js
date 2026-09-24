'use strict';

/** Replace the active late-fee rule without changing historical loan snapshots. */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const sequelize = queryInterface.sequelize;
      await sequelize.query("SELECT pg_advisory_xact_lock(hashtext('config:late_fee_policy'))", { transaction });
      const [zeroPolicies] = await sequelize.query(`
        SELECT id
        FROM "ConfigEntries"
        WHERE category = 'late_fee_policy'
          AND jsonb_typeof(value->'annualEffectiveRate') = 'number'
          AND (value->>'annualEffectiveRate')::numeric = 0
          AND UPPER(value->>'lateFeeMode') = 'NONE'
        ORDER BY "isActive" DESC, id
        LIMIT 1
        FOR UPDATE
      `, { transaction });
      const existingZeroId = zeroPolicies[0]?.id;
      if (!existingZeroId) {
        const [reservedKey] = await sequelize.query(`
          SELECT id FROM "ConfigEntries"
          WHERE category = 'late_fee_policy' AND key = 'no-late-fee-20260924'
        `, { transaction });
        if (reservedKey.length > 0) {
          throw new Error('The zero late-fee policy key is already used by a nonzero policy');
        }
      }

      await sequelize.query(`
        UPDATE "ConfigEntries" SET "isActive" = false, "updatedAt" = NOW()
        WHERE category = 'late_fee_policy' AND "isActive" = true
      `, { transaction });
      if (existingZeroId) {
        await sequelize.query(`
          UPDATE "ConfigEntries" SET "isActive" = true, "updatedAt" = NOW()
          WHERE id = :id
        `, { replacements: { id: existingZeroId }, transaction });
      } else {
        await sequelize.query(`
          INSERT INTO "ConfigEntries"
            (category, key, label, value, "isActive", "createdAt", "updatedAt")
          VALUES
            ('late_fee_policy', 'no-late-fee-20260924', 'Sin mora',
             '{"annualEffectiveRate":0,"lateFeeMode":"NONE","priority":"medium","description":"Créditos sin mora nueva.","metadata":{"configuredFor":"2026-09-24"}}'::jsonb,
             true, NOW(), NOW())
        `, { transaction });
      }
    });
  },

  async down() {
    throw new Error('Reverting the active late-fee rule requires an explicit business decision; loans may now reference the 0% policy.');
  },
};
