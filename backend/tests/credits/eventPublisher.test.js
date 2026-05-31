const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const { createEventPublisher, createHttpEventPublisher, buildAmortizationPayload } = require('@/modules/credits/application/eventPublisher');

const originalOutboxWebhookTimeout = process.env.OUTBOX_WEBHOOK_TIMEOUT_MS;

afterEach(() => {
  if (originalOutboxWebhookTimeout === undefined) {
    delete process.env.OUTBOX_WEBHOOK_TIMEOUT_MS;
  } else {
    process.env.OUTBOX_WEBHOOK_TIMEOUT_MS = originalOutboxWebhookTimeout;
  }
});

test('buildAmortizationPayload keeps a provided eventId', () => {
  const payload = buildAmortizationPayload({
    loanId: 7,
    transactionId: 'tx-7',
    previousBalance: 1000,
    newBalance: 800,
    breakdown: { capital: 100, interest: 100 },
    eventId: 'fixed-id',
  });

  assert.equal(payload.eventId, 'fixed-id');
});

test('publishAmortizationCalculatedEvent persists an outbox event with payload metadata', async () => {
  let capturedEvent;
  const repo = {
    create: async (event) => {
      capturedEvent = event;
      return event;
    },
  };

  const publisher = createEventPublisher({ outboxEventRepository: repo });
  const createdEvent = await publisher.publishAmortizationCalculatedEvent({
    loanId: 8,
    transactionId: 'tx-8',
    previousBalance: 2000,
    newBalance: 1800,
    breakdown: { capital: 200, interest: 0, penalty: 0 },
    eventId: 'test-event-8',
  });

  assert.equal(createdEvent.eventType, 'AmortizationCalculatedEvent');
  assert.equal(capturedEvent.payload.eventId, 'test-event-8');
  assert.equal(capturedEvent.payload._deliveryAttempts, 0);
});

test('createHttpEventPublisher rejects malformed timeout env values', () => {
  process.env.OUTBOX_WEBHOOK_TIMEOUT_MS = '3000ms';

  assert.throws(
    () => createHttpEventPublisher({ endpointUrl: 'https://outbox.example.test/events' }),
    /OUTBOX_WEBHOOK_TIMEOUT_MS must be a positive integer/,
  );
});
