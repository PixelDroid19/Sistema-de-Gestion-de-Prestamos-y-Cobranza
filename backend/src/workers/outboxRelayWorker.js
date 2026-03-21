const { createOutboxEventRepository } = require('../modules/credits/infrastructure/outboxEventRepository');

const createOutboxRelayWorker = ({
  outboxEventRepository = createOutboxEventRepository(),
  logger = console,
  setIntervalFn = setInterval,
  clearIntervalFn = clearInterval,
} = {}) => {
  let intervalHandle = null;
  let isRunning = false;

  const processEventsInternal = async () => {
    const pendingEvents = await outboxEventRepository.findPending(100);

    for (const event of pendingEvents) {
      try {
        logger.log(`[OutboxRelay] Publishing event ${event.id} (${event.eventType}) for ${event.aggregateType}:${event.aggregateId}`);

        await outboxEventRepository.markAsProcessed(event.id);

        logger.log(`[OutboxRelay] Successfully published event ${event.id}`);
      } catch (error) {
        logger.error(`[OutboxRelay] Failed to publish event ${event.id}:`, error.message);
        await outboxEventRepository.markAsFailed(event.id, error);
      }
    }
  };

  const start = (pollIntervalMs = 5000) => {
    if (isRunning) {
      logger.warn('[OutboxRelay] Worker already running');
      return;
    }

    isRunning = true;
    logger.log(`[OutboxRelay] Starting worker with poll interval ${pollIntervalMs}ms`);

    processEventsInternal();

    intervalHandle = setIntervalFn(() => {
      if (isRunning) {
        processEventsInternal();
      }
    }, pollIntervalMs);
  };

  const stop = () => {
    if (!isRunning) {
      logger.warn('[OutboxRelay] Worker not running');
      return;
    }

    isRunning = false;
    if (intervalHandle) {
      clearIntervalFn(intervalHandle);
      intervalHandle = null;
    }
    logger.log('[OutboxRelay] Worker stopped');
  };

  const processPendingEvents = async () => {
    if (!isRunning) return;
    await processEventsInternal();
  };

  return { start, stop, processPendingEvents };
};

module.exports = { createOutboxRelayWorker };