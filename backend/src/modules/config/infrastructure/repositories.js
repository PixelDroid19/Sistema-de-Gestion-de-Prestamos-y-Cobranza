const { ConfigEntry } = require('@/models');

const PAYMENT_METHOD_CATEGORY = 'payment_method';
const BUSINESS_SETTING_CATEGORY = 'business_setting';
const TNA_RATE_CATEGORY = 'tna_rate';
const LATE_FEE_POLICY_CATEGORY = 'late_fee_policy';
const INTEREST_NODE_CATEGORY = 'interest_node';

const serializeConfigEntry = (entry) => {
  if (!entry) {
    return null;
  }

  return typeof entry.toJSON === 'function' ? entry.toJSON() : entry;
};

const configRepository = {
  async listByCategory(category) {
    const entries = await ConfigEntry.findAll({
      where: { category },
      order: [['label', 'ASC'], ['createdAt', 'ASC']],
    });

    return entries.map(serializeConfigEntry);
  },

  async listActiveByCategory(category) {
    const entries = await ConfigEntry.findAll({
      where: { category, isActive: true },
      order: [['updatedAt', 'DESC'], ['createdAt', 'DESC']],
    });

    return entries.map(serializeConfigEntry);
  },

  async findPaymentMethodById(id) {
    const entry = await ConfigEntry.findOne({
      where: { id, category: PAYMENT_METHOD_CATEGORY },
    });

    return serializeConfigEntry(entry);
  },

  async findById(id) {
    const entry = await ConfigEntry.findByPk(id);
    return serializeConfigEntry(entry);
  },

  async findByCategoryAndKey(category, key) {
    const entry = await ConfigEntry.findOne({
      where: { category, key },
    });

    return serializeConfigEntry(entry);
  },

  async findActiveByCategoryAndKey(category, key) {
    const entry = await ConfigEntry.findOne({
      where: { category, key, isActive: true },
      order: [['updatedAt', 'DESC'], ['createdAt', 'DESC']],
    });

    return serializeConfigEntry(entry);
  },

  async create({ category, key, label, value, isActive = true }) {
    const entry = await ConfigEntry.create({ category, key, label, value, isActive });
    return serializeConfigEntry(entry);
  },

  async update(id, payload) {
    const entry = await ConfigEntry.findByPk(id);
    if (!entry) {
      return null;
    }

    await entry.update(payload);
    return serializeConfigEntry(entry);
  },

  async destroy(id) {
    return ConfigEntry.destroy({ where: { id } });
  },
};

module.exports = {
  PAYMENT_METHOD_CATEGORY,
  BUSINESS_SETTING_CATEGORY,
  TNA_RATE_CATEGORY,
  LATE_FEE_POLICY_CATEGORY,
  INTEREST_NODE_CATEGORY,
  configRepository,
};
