const { ConfigEntry, Loan } = require('@/models');

const PAYMENT_METHOD_CATEGORY = 'payment_method';
const BUSINESS_SETTING_CATEGORY = 'business_setting';
const RATE_POLICY_CATEGORY = 'rate_policy';
const LATE_FEE_POLICY_CATEGORY = 'late_fee_policy';

const withTransaction = (options = {}) => (
  options.transaction ? { transaction: options.transaction } : {}
);

const serializeConfigEntry = (entry) => {
  if (!entry) {
    return null;
  }

  return typeof entry.toJSON === 'function' ? entry.toJSON() : entry;
};

const configRepository = {
  async runInTransaction(work) {
    return ConfigEntry.sequelize.transaction(work);
  },

  async listByCategory(category, options = {}) {
    const entries = await ConfigEntry.findAll({
      where: { category },
      order: [['label', 'ASC'], ['createdAt', 'ASC']],
      ...withTransaction(options),
    });

    return entries.map(serializeConfigEntry);
  },

  async listActiveByCategory(category, options = {}) {
    const entries = await ConfigEntry.findAll({
      where: { category, isActive: true },
      order: [['updatedAt', 'DESC'], ['createdAt', 'DESC']],
      ...withTransaction(options),
    });

    return entries.map(serializeConfigEntry);
  },

  async findPaymentMethodById(id, options = {}) {
    const entry = await ConfigEntry.findOne({
      where: { id, category: PAYMENT_METHOD_CATEGORY },
      ...withTransaction(options),
    });

    return serializeConfigEntry(entry);
  },

  async findByIdAndCategory(id, category, options = {}) {
    const entry = await ConfigEntry.findOne({
      where: { id, category },
      ...withTransaction(options),
    });

    return serializeConfigEntry(entry);
  },

  async findByCategoryAndKey(category, key, options = {}) {
    const entry = await ConfigEntry.findOne({
      where: { category, key },
      ...withTransaction(options),
    });

    return serializeConfigEntry(entry);
  },

  async create({ category, key, label, value, isActive = true }, options = {}) {
    const entry = await ConfigEntry.create(
      { category, key, label, value, isActive },
      withTransaction(options),
    );
    return serializeConfigEntry(entry);
  },

  async update(id, payload, options = {}) {
    const entry = await ConfigEntry.findByPk(id, withTransaction(options));
    if (!entry) {
      return null;
    }

    await entry.update(payload, withTransaction(options));
    return serializeConfigEntry(entry);
  },

  async destroy(id, options = {}) {
    return ConfigEntry.destroy({ where: { id }, ...withTransaction(options) });
  },

  async countLoansUsingRatePolicy(id, options = {}) {
    return Loan.count({ where: { ratePolicyId: id }, ...withTransaction(options) });
  },

  async countLoansUsingLateFeePolicy(id, options = {}) {
    return Loan.count({ where: { lateFeePolicyId: id }, ...withTransaction(options) });
  },
};

module.exports = {
  PAYMENT_METHOD_CATEGORY,
  BUSINESS_SETTING_CATEGORY,
  RATE_POLICY_CATEGORY,
  LATE_FEE_POLICY_CATEGORY,
  configRepository,
};
