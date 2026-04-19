const { OutboxEvent } = require('@/models');

const createOutboxEventRepository = ({ outboxEventModel = OutboxEvent } = {}) => ({
  async create(event) {
    return outboxEventModel.create(event);
  },

  async findPending(limit = 100) {
    return outboxEventModel.findAll({
      where: { status: 'PENDING' },
      order: [['createdAt', 'ASC']],
      limit,
    });
  },

  async markAsProcessed(id) {
    return outboxEventModel.update(
      { status: 'PROCESSED', processedAt: new Date() },
      { where: { id } }
    );
  },

  async markAsFailed(id, error) {
    return outboxEventModel.update(
      {
        status: 'FAILED',
        processedAt: new Date(),
        payload: {
          ...(await this._getPayload(id)),
          _error: error?.message || String(error),
          _failedAt: new Date().toISOString(),
        },
      },
      { where: { id } }
    );
  },

  async _getPayload(id) {
    const event = await outboxEventModel.findByPk(id);
    return event?.payload || {};
  },
});

module.exports = { createOutboxEventRepository };