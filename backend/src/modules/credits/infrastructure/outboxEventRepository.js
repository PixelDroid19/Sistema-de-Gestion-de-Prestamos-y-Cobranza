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

  async markAsProcessing(id, startedAt = new Date().toISOString(), extraPayload = {}) {
    const event = await outboxEventModel.findByPk(id);
    if (!event || event.status !== 'PENDING') {
      return 0;
    }

    const currentPayload = event.payload || {};
    const payload = {
      ...(currentPayload || {}),
      _deliveryAttempts: Number.isFinite(Number(currentPayload._deliveryAttempts))
        ? Number(currentPayload._deliveryAttempts)
        : Number(currentPayload._deliveryAttempts || 0),
      _processingStartedAt: startedAt,
      ...extraPayload,
    };

    const [updated] = await outboxEventModel.update(
      { status: 'PROCESSING', payload },
      { where: { id, status: 'PENDING' } }
    );

    return updated;
  },

  async markAsProcessed(id, { payload: updatedPayload } = {}) {
    const event = await outboxEventModel.findByPk(id);
    if (!event || event.status !== 'PROCESSING') {
      return [0];
    }

    const currentPayload = event.payload || {};
    const payload = {
      ...currentPayload,
      _processedAt: new Date().toISOString(),
      ...updatedPayload,
    };

    return outboxEventModel.update(
      { status: 'PROCESSED', processedAt: new Date(), payload },
      { where: { id, status: 'PROCESSING' } }
    );
  },

  async markAsFailed(id, error, {
    attempts,
    terminal = false,
    nextRetryAt = null,
    processedAt = new Date(),
    extraPayload = {},
  } = {}) {
    const event = await outboxEventModel.findByPk(id);
    if (!event) {
      return [0];
    }

    const currentPayload = event.payload || {};
    const previousAttempts = Number.isFinite(Number(currentPayload._deliveryAttempts)) ? Number(currentPayload._deliveryAttempts) : 0;
    const deliveryAttempts = Number.isFinite(Number(attempts)) ? Number(attempts) : previousAttempts + 1;
    const retryAt = nextRetryAt ? (typeof nextRetryAt.toISOString === 'function' ? nextRetryAt.toISOString() : String(nextRetryAt)) : null;
    const payload = {
      ...currentPayload,
      _deliveryAttempts: deliveryAttempts,
      _error: error?.message || String(error),
      _lastAttemptAt: new Date().toISOString(),
      _lastFailureAt: new Date().toISOString(),
      ...(terminal ? {} : { _nextRetryAt: retryAt }),
      ...extraPayload,
    };

    if (terminal && Object.prototype.hasOwnProperty.call(payload, '_nextRetryAt')) {
      delete payload._nextRetryAt;
    }

    return outboxEventModel.update(
      {
        status: terminal ? 'FAILED' : 'PENDING',
        processedAt: terminal ? processedAt : null,
        payload,
      },
      { where: { id, status: 'PROCESSING' } }
    );
  },

  async _getPayload(id) {
    const event = await outboxEventModel.findByPk(id);
    return event?.payload || {};
  },
});

module.exports = { createOutboxEventRepository };
