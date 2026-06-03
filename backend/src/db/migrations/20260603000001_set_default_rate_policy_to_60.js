'use strict';

const RATE_POLICY_DEFAULT_KEY = 'standard-credit';

const updateSeededDefaultRate = async ({ queryInterface, fromRate, toRate, transaction }) => {
  await queryInterface.sequelize.query(`
    UPDATE "ConfigEntries"
    SET "value" = jsonb_set(COALESCE("value", '{}'::jsonb), '{annualEffectiveRate}', :toRate::jsonb, true),
        "updatedAt" = NOW()
    WHERE "category" = 'rate_policy'
      AND "key" = :key
      AND COALESCE(("value"->'metadata'->>'seeded')::boolean, false) = true
      AND jsonb_typeof("value"->'annualEffectiveRate') = 'number'
      AND ("value"->>'annualEffectiveRate')::numeric = :fromRate
  `, {
    replacements: {
      key: RATE_POLICY_DEFAULT_KEY,
      fromRate,
      toRate: String(toRate),
    },
    transaction,
  });
};

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await updateSeededDefaultRate({
        queryInterface,
        fromRate: 36,
        toRate: 60,
        transaction,
      });
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await updateSeededDefaultRate({
        queryInterface,
        fromRate: 60,
        toRate: 36,
        transaction,
      });
    });
  },
};
