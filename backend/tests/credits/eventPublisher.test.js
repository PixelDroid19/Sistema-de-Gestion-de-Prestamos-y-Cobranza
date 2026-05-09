const { test } = require('node:test');
const assert = require('node:assert/strict');

const { createEventPublisher, buildAmortizationPayload } = require('@/modules/credits/application/eventPublisher');

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
