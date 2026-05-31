const { test, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');

const { createOutboxRelayWorker } = require('@/workers/outboxRelayWorker');

const originalOutboxEnv = {
  OUTBOX_MAX_DELIVERY_ATTEMPTS: process.env.OUTBOX_MAX_DELIVERY_ATTEMPTS,
  OUTBOX_RETRY_MULTIPLIER: process.env.OUTBOX_RETRY_MULTIPLIER,
};

afterEach(() => {
  mock.restoreAll();
  for (const [key, value] of Object.entries(originalOutboxEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

test('start sets up polling with setInterval', () => {
  let capturedTimeout;
  let capturedHandler;

  const mockSetInterval = (handler, timeout) => {
    capturedTimeout = timeout;
    capturedHandler = handler;
    return 123;
  };

  const mockRepo = {
    findPending: async () => [],
    markAsProcessing: async () => 0,
    markAsProcessed: async () => [1],
    markAsFailed: async () => [1],
  };

  const worker = createOutboxRelayWorker({
    outboxEventRepository: mockRepo,
    eventPublisher: { publish: async () => ({ published: true }) },
    logger: { log: () => {}, warn: () => {}, error: () => {}, info: () => {}, debug: () => {} },
    setIntervalFn: mockSetInterval,
    clearIntervalFn: () => {},
  });

  worker.start(1000);

  assert.equal(capturedTimeout, 1000);
  assert.equal(typeof capturedHandler, 'function');
});

test('processPendingEvents publishes events and marks them as processed', async () => {
  const event = {
    id: 'evt-1',
    aggregateType: 'LoanTransaction',
    aggregateId: 'tx-1',
    eventType: 'AmortizationCalculatedEvent',
    payload: { eventId: 'payload-1', _deliveryAttempts: 0 },
  };

  const markProcessedArgs = [];
  const mockRepo = {
    findPending: async () => [event],
    markAsProcessing: async () => 1,
    markAsProcessed: async (id, details) => {
      markProcessedArgs.push({ id, details });
      return [1];
    },
    markAsFailed: async () => [1],
  };

  const publishedPayloads = [];
  const mockPublisher = { publish: async (payload) => {
    publishedPayloads.push(payload);
    return { published: true, status: 200 };
  }};

  const worker = createOutboxRelayWorker({
    outboxEventRepository: mockRepo,
    eventPublisher: mockPublisher,
    logger: { log: () => {}, warn: () => {}, error: () => {}, info: () => {}, debug: () => {} },
    setIntervalFn: () => 7,
    clearIntervalFn: () => {},
  });

  worker.start(1000);
  await worker.processPendingEvents();
  worker.stop();

  assert.equal(publishedPayloads.length >= 1, true);
  assert.equal(markProcessedArgs[markProcessedArgs.length - 1].id, 'evt-1');
  assert.equal(markProcessedArgs[markProcessedArgs.length - 1].details.payload._deliveryAttempts, 0);
  assert.equal(markProcessedArgs[markProcessedArgs.length - 1].details.payload._publishResult.status, 200);
});

test('processPendingEvents retries failed events instead of marking them processed', async () => {
  const event = {
    id: 'evt-2',
    aggregateType: 'LoanTransaction',
    aggregateId: 'tx-2',
    eventType: 'AmortizationCalculatedEvent',
    payload: { eventId: 'payload-2', _deliveryAttempts: 0 },
  };

  let failedArgs;
  const mockRepo = {
    findPending: async () => [event],
    markAsProcessing: async () => 1,
    markAsProcessed: async () => [1],
    markAsFailed: async (_id, _error, args) => {
      failedArgs = { _id, args };
      return [1];
    },
  };

  const mockPublisher = { publish: async () => {
    throw new Error('network timeout');
  }};

  const worker = createOutboxRelayWorker({
    outboxEventRepository: mockRepo,
    eventPublisher: mockPublisher,
    maxDeliveryAttempts: 3,
    logger: { log: () => {}, warn: () => {}, error: () => {}, info: () => {}, debug: () => {} },
    setIntervalFn: () => 1,
    clearIntervalFn: () => {},
  });

  worker.start(1000);
  await worker.processPendingEvents();
  worker.stop();

  assert.ok(Boolean(failedArgs));
  assert.equal(failedArgs._id, 'evt-2');
  assert.equal(failedArgs.args.attempts, 1);
  assert.equal(failedArgs.args.terminal, false);
  assert.ok(failedArgs.args.nextRetryAt instanceof Date);
});

test('processPendingEvents marks failed events as terminal when max attempts reached', async () => {
  const event = {
    id: 'evt-3',
    aggregateType: 'LoanTransaction',
    aggregateId: 'tx-3',
    eventType: 'AmortizationCalculatedEvent',
    payload: { eventId: 'payload-3', _deliveryAttempts: 0 },
  };

  let failedArgs;
  const mockRepo = {
    findPending: async () => [event],
    markAsProcessing: async () => 1,
    markAsProcessed: async () => [1],
    markAsFailed: async (_id, _error, args) => {
      failedArgs = { _id, args };
      return [1];
    },
  };

  const mockPublisher = { publish: async () => {
    throw new Error('gateway rejected');
  }};

  const worker = createOutboxRelayWorker({
    outboxEventRepository: mockRepo,
    eventPublisher: mockPublisher,
    maxDeliveryAttempts: 1,
    logger: { log: () => {}, warn: () => {}, error: () => {}, info: () => {}, debug: () => {} },
    setIntervalFn: () => 1,
    clearIntervalFn: () => {},
  });

  worker.start(1000);
  await worker.processPendingEvents();
  worker.stop();

  assert.equal(failedArgs._id, 'evt-3');
  assert.equal(failedArgs.args.attempts, 1);
  assert.equal(failedArgs.args.terminal, true);
});

test('events with future retry windows are left in pending state', async () => {
  const nextRetryAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  const event = {
    id: 'evt-4',
    aggregateType: 'LoanTransaction',
    aggregateId: 'tx-4',
    eventType: 'AmortizationCalculatedEvent',
    payload: { eventId: 'payload-4', _deliveryAttempts: 0, _nextRetryAt: nextRetryAt },
  };

  let markAsProcessingCalled = 0;
  const mockRepo = {
    findPending: async () => [event],
    markAsProcessing: async () => {
      markAsProcessingCalled += 1;
      return 1;
    },
    markAsProcessed: async () => [1],
    markAsFailed: async () => [1],
  };

  const mockPublisher = { publish: async () => ({ published: true }) };

  const worker = createOutboxRelayWorker({
    outboxEventRepository: mockRepo,
    eventPublisher: mockPublisher,
    logger: { log: () => {}, warn: () => {}, error: () => {}, info: () => {}, debug: () => {} },
    setIntervalFn: () => 1,
    clearIntervalFn: () => {},
  });

  worker.start(1000);
  await worker.processPendingEvents();
  worker.stop();

  assert.equal(markAsProcessingCalled, 0);
});

test('stop is idempotent when worker is not running', () => {
  let warningMessages = [];

  const worker = createOutboxRelayWorker({
    outboxEventRepository: { findPending: async () => [], markAsProcessing: async () => 1, markAsProcessed: async () => [1], markAsFailed: async () => [1] },
    logger: {
      log: () => {},
      warn: (msg) => warningMessages.push(msg),
      error: () => {},
      info: () => {},
      debug: () => {},
    },
    setIntervalFn: () => 1,
    clearIntervalFn: () => {},
  });

  worker.stop();

  assert.equal(warningMessages.length, 1);
  assert.ok(warningMessages[0].includes('not running'));
});

test('worker rejects malformed max retry env values', () => {
  process.env.OUTBOX_MAX_DELIVERY_ATTEMPTS = '5x';

  assert.throws(
    () => createOutboxRelayWorker({
      outboxEventRepository: { findPending: async () => [], markAsProcessing: async () => 1, markAsProcessed: async () => [1], markAsFailed: async () => [1] },
      eventPublisher: { publish: async () => ({ published: true }) },
      logger: { log: () => {}, warn: () => {}, error: () => {}, info: () => {}, debug: () => {} },
      setIntervalFn: () => 1,
      clearIntervalFn: () => {},
    }),
    /OUTBOX_MAX_DELIVERY_ATTEMPTS must be a positive integer/,
  );
});

test('worker rejects malformed retry multiplier env values', () => {
  process.env.OUTBOX_RETRY_MULTIPLIER = '1.2.3';

  assert.throws(
    () => createOutboxRelayWorker({
      outboxEventRepository: { findPending: async () => [], markAsProcessing: async () => 1, markAsProcessed: async () => [1], markAsFailed: async () => [1] },
      eventPublisher: { publish: async () => ({ published: true }) },
      logger: { log: () => {}, warn: () => {}, error: () => {}, info: () => {}, debug: () => {} },
      setIntervalFn: () => 1,
      clearIntervalFn: () => {},
    }),
    /OUTBOX_RETRY_MULTIPLIER must be a positive number/,
  );
});
