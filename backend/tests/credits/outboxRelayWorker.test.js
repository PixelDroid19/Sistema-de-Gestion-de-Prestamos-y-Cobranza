const { test, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');

const { createOutboxRelayWorker } = require('../../src/workers/outboxRelayWorker');

afterEach(() => {
  mock.restoreAll();
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
  };

  const worker = createOutboxRelayWorker({
    outboxEventRepository: mockRepo,
    logger: { log: () => {}, warn: () => {}, error: () => {} },
    setIntervalFn: mockSetInterval,
    clearIntervalFn: () => {},
  });

  worker.start(1000);

  assert.equal(capturedTimeout, 1000);
  assert.equal(typeof capturedHandler, 'function');
});

test('stop clears the interval', () => {
  let capturedHandle;
  let clearIntervalCalled = false;

  const mockSetInterval = (handler, timeout) => {
    capturedHandle = 999;
    return capturedHandle;
  };

  const mockClearInterval = (handle) => {
    if (handle === capturedHandle) {
      clearIntervalCalled = true;
    }
  };

  const mockRepo = { findPending: async () => [] };

  const worker = createOutboxRelayWorker({
    outboxEventRepository: mockRepo,
    logger: { log: () => {}, warn: () => {}, error: () => {} },
    setIntervalFn: mockSetInterval,
    clearIntervalFn: mockClearInterval,
  });

  worker.start(1000);
  worker.stop();

  assert.equal(clearIntervalCalled, true);
});

test('start warns if worker is already running', () => {
  let warningMessages = [];

  const worker = createOutboxRelayWorker({
    outboxEventRepository: { findPending: async () => [] },
    logger: {
      log: () => {},
      warn: (msg) => warningMessages.push(msg),
      error: () => {},
    },
    setIntervalFn: () => 999,
    clearIntervalFn: () => {},
  });

  worker.start(1000);
  worker.start(1000);

  assert.equal(warningMessages.length, 1);
  assert.ok(warningMessages[0].includes('already running'));
});

test('stop is idempotent when worker is not running', () => {
  let warningMessages = [];

  const worker = createOutboxRelayWorker({
    outboxEventRepository: { findPending: async () => [] },
    logger: {
      log: () => {},
      warn: (msg) => warningMessages.push(msg),
      error: () => {},
    },
    setIntervalFn: () => 1,
    clearIntervalFn: () => {},
  });

  worker.stop();

  assert.equal(warningMessages.length, 1);
  assert.ok(warningMessages[0].includes('not running'));
});

test('processPendingEvents returns early when worker not started', async () => {
  let findPendingCalled = false;

  const mockRepo = {
    findPending: async () => {
      findPendingCalled = true;
      return [];
    },
  };

  const mockLogger = {
    log: () => {},
    warn: () => {},
    error: () => {},
  };

  const worker = createOutboxRelayWorker({
    outboxEventRepository: mockRepo,
    logger: mockLogger,
    setIntervalFn: () => {},
    clearIntervalFn: () => {},
  });

  await worker.processPendingEvents();

  assert.equal(findPendingCalled, false);
});