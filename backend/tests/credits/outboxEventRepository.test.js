const { test } = require('node:test');
const assert = require('node:assert/strict');

const { createOutboxEventRepository } = require('@/modules/credits/infrastructure/outboxEventRepository');

const createInMemoryOutboxModel = () => {
  const rows = [];

  const findByPk = async (id) => rows.find((entry) => entry.id === id) || null;

  const matchWhere = (row, where = {}) => {
    if (!row) return false;
    return Object.entries(where).every(([field, value]) => row[field] === value);
  };

  return {
    rows,
    async create(event) {
      const record = {
        id: event.id || `event-${rows.length + 1}`,
        status: event.status || 'PENDING',
        payload: event.payload || {},
        aggregateType: event.aggregateType || null,
        aggregateId: event.aggregateId || null,
        eventType: event.eventType || null,
        ...event,
      };
      rows.push(record);
      return record;
    },
    async findAll({ where, order = [['createdAt', 'ASC']], limit = rows.length }) {
      let filtered = rows.filter((entry) => matchWhere(entry, where));

      if (order && order.length > 0) {
        const [field, direction] = order[0];
        const factor = String(direction || '').toUpperCase() === 'DESC' ? -1 : 1;
        filtered = filtered.sort((a, b) => {
          const lhs = a[field] || 0;
          const rhs = b[field] || 0;
          return factor * (lhs > rhs ? 1 : lhs < rhs ? -1 : 0);
        });
      }

      return filtered.slice(0, limit);
    },
    async update(values, { where }) {
      let count = 0;
      for (const entry of rows) {
        if (!matchWhere(entry, where)) continue;

        Object.assign(entry, values);
        count += 1;
      }
      return [count];
    },
    findByPk,
  };
};

test('markAsProcessing moves pending rows to processing', async () => {
  const model = createInMemoryOutboxModel();
  const repo = createOutboxEventRepository({ outboxEventModel: model });

  const created = await repo.create({
    aggregateType: 'LoanTransaction',
    aggregateId: 'tx-1',
    eventType: 'AmortizationCalculatedEvent',
    payload: { _deliveryAttempts: 0 },
    status: 'PENDING',
  });

  const claimed = await repo.markAsProcessing(created.id);
  const updated = await model.findByPk(created.id);

  assert.equal(claimed, 1);
  assert.equal(updated.status, 'PROCESSING');
});

test('markAsProcessing ignores already claimed rows', async () => {
  const model = createInMemoryOutboxModel();
  const repo = createOutboxEventRepository({ outboxEventModel: model });

  const created = await repo.create({
    aggregateType: 'LoanTransaction',
    aggregateId: 'tx-1',
    eventType: 'AmortizationCalculatedEvent',
    payload: { _deliveryAttempts: 0 },
    status: 'PROCESSING',
  });

  const claimed = await repo.markAsProcessing(created.id);

  assert.equal(claimed, 0);
});

test('markAsProcessing normalizes invalid delivery attempts to zero before claiming the row', async () => {
  const model = createInMemoryOutboxModel();
  const repo = createOutboxEventRepository({ outboxEventModel: model });

  const created = await repo.create({
    aggregateType: 'LoanTransaction',
    aggregateId: 'tx-invalid-attempts',
    eventType: 'AmortizationCalculatedEvent',
    payload: { _deliveryAttempts: 'no-numero' },
    status: 'PENDING',
  });

  const claimed = await repo.markAsProcessing(created.id);
  const updated = await model.findByPk(created.id);

  assert.equal(claimed, 1);
  assert.equal(updated.status, 'PROCESSING');
  assert.equal(updated.payload._deliveryAttempts, 0);
});

test('markAsProcessed only succeeds for processing rows', async () => {
  const model = createInMemoryOutboxModel();
  const repo = createOutboxEventRepository({ outboxEventModel: model });
  const pending = await repo.create({ aggregateType: 'LoanTransaction', aggregateId: 'tx-1', eventType: 'AmortizationCalculatedEvent', payload: {} });

  await repo.markAsProcessing(pending.id);
  const updated = await repo.markAsProcessed(pending.id, { payload: { _deliveryAttempts: 2 } });
  const failed = await repo.markAsProcessed(pending.id, { payload: {} });

  assert.equal(updated[0], 1);
  assert.equal(failed[0], 0);
});

test('markAsFailed sets retry metadata and terminal state', async () => {
  const model = createInMemoryOutboxModel();
  const repo = createOutboxEventRepository({ outboxEventModel: model });
  const created = await repo.create({
    aggregateType: 'LoanTransaction',
    aggregateId: 'tx-2',
    eventType: 'AmortizationCalculatedEvent',
    payload: { _deliveryAttempts: 1 },
    status: 'PROCESSING',
  });

  const firstFailure = new Date().toISOString();
  const nextRetry = new Date(Date.now() + 10000);
  await repo.markAsFailed(created.id, new Error('simulated'), {
    attempts: 2,
    terminal: false,
    nextRetryAt: nextRetry,
    extraPayload: { _failedAt: firstFailure },
  });
  const retried = await model.findByPk(created.id);

  assert.equal(retried.status, 'PENDING');
  assert.equal(retried.payload._deliveryAttempts, 2);
  assert.equal(retried.payload._nextRetryAt, nextRetry.toISOString());
  assert.equal(retried.payload._failedAt, firstFailure);

  await repo.markAsProcessing(retried.id);
  await repo.markAsFailed(retried.id, new Error('again'), { attempts: 3, terminal: true, nextRetryAt: null });
  const failed = await model.findByPk(created.id);

  assert.equal(failed.status, 'FAILED');
  assert.equal(failed.payload._deliveryAttempts, 3);
  assert.equal(failed.payload._nextRetryAt, undefined);
});
