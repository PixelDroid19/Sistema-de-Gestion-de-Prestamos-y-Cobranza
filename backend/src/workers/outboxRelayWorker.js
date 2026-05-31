const { createOutboxEventRepository } = require('@/modules/credits/infrastructure/outboxEventRepository');
const { createHttpEventPublisher, createNoopEventPublisher } = require('@/modules/credits/application/eventPublisher');

const parseIntegerEnv = (key, defaultValue, { allowZero = false } = {}) => {
  const raw = process.env[key];
  if (raw === undefined || raw === '') {
    return defaultValue;
  }

  const normalized = String(raw).trim();
  const pattern = allowZero ? /^(0|[1-9]\d*)$/ : /^[1-9]\d*$/;
  if (!pattern.test(normalized)) {
    throw new Error(`${key} must be a ${allowZero ? 'non-negative' : 'positive'} integer.`);
  }

  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`${key} must be a ${allowZero ? 'non-negative' : 'positive'} integer.`);
  }

  return parsed;
};

const parsePositiveNumberEnv = (key, defaultValue) => {
  const raw = process.env[key];
  if (raw === undefined || raw === '') {
    return defaultValue;
  }

  const normalized = String(raw).trim();
  if (!/^(?:[1-9]\d*(?:\.\d+)?|0?\.\d+)$/.test(normalized)) {
    throw new Error(`${key} must be a positive number.`);
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${key} must be a positive number.`);
  }

  return parsed;
};

const resolveRetryTimestamp = (value) => {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const isDue = (event, now = new Date()) => {
  const nextRetryAt = resolveRetryTimestamp(event?.payload?._nextRetryAt);
  if (!nextRetryAt) {
    return true;
  }

  return nextRetryAt.getTime() <= now.getTime();
};

const calculateRetryDelayMs = (attemptNumber, {
  baseDelayMs = 1000,
  maxDelayMs = 60000,
  backoffMultiplier = 2,
  jitterMs = 250,
} = {}) => {
  const attempt = Number.isFinite(attemptNumber) ? attemptNumber : 1;
  const base = Number.isFinite(baseDelayMs) && baseDelayMs > 0 ? Math.round(baseDelayMs) : 1000;
  const max = Number.isFinite(maxDelayMs) && maxDelayMs > 0 ? Math.round(maxDelayMs) : 60000;
  const multiplier = Number.isFinite(backoffMultiplier) && backoffMultiplier > 1 ? backoffMultiplier : 2;
  const jitter = Number.isFinite(jitterMs) && jitterMs > 0 ? Math.round(Math.random() * jitterMs) : 0;

  const exponentialDelay = base * Math.pow(multiplier, Math.max(1, attempt) - 1);
  return Math.max(200, Math.min(max, Math.round(exponentialDelay + jitter)));
};

const resolveEventPublisher = ({ logger, eventPublisher }) => {
  if (eventPublisher) {
    return eventPublisher;
  }

  const configuredDestination = String(process.env.OUTBOX_WEBHOOK_URL || '').trim();
  if (!configuredDestination) {
    return createNoopEventPublisher({ logger });
  }

  return createHttpEventPublisher({ logger });
};

const createOutboxRelayWorker = ({
  outboxEventRepository = createOutboxEventRepository(),
  eventPublisher: providedEventPublisher,
  logger = console,
  setIntervalFn = setInterval,
  clearIntervalFn = clearInterval,
  pollIntervalMs = 5000,
  batchSize = 100,
  maxDeliveryAttempts = parseIntegerEnv('OUTBOX_MAX_DELIVERY_ATTEMPTS', 5),
  baseRetryDelayMs = parseIntegerEnv('OUTBOX_RETRY_BASE_DELAY_MS', 1000),
  retryMultiplier = parsePositiveNumberEnv('OUTBOX_RETRY_MULTIPLIER', 2),
  retryJitterMs = parseIntegerEnv('OUTBOX_RETRY_JITTER_MS', 250, { allowZero: true }),
  maxRetryDelayMs = parseIntegerEnv('OUTBOX_RETRY_MAX_DELAY_MS', 60000),
} = {}) => {
  const eventPublisher = resolveEventPublisher({ logger, eventPublisher: providedEventPublisher });
  let intervalHandle = null;
  let isRunning = false;

  const processEventsInternal = async () => {
    const now = new Date();
    const pendingEvents = await outboxEventRepository.findPending(batchSize);

    for (const event of pendingEvents) {
      const eventPayload = event?.payload || {};
      const attempts = Number.isFinite(Number(eventPayload._deliveryAttempts)) ? Number(eventPayload._deliveryAttempts) : 0;
      const eventId = eventPayload.eventId;

      if (!isDue(event, now)) {
        logger.debug?.('[OutboxRelay] Event waiting for retry', {
          eventId,
          aggregateType: event.aggregateType,
          aggregateId: event.aggregateId,
          nextRetryAt: eventPayload._nextRetryAt,
        });
        continue;
      }

      const claimed = await outboxEventRepository.markAsProcessing(event.id);
      if (!claimed) {
        continue;
      }

      const scope = event.aggregateType;

      logger.info?.('[OutboxRelay] Publishing event', {
        eventId,
        scope,
        aggregateId: event.aggregateId,
        eventType: event.eventType,
        attempts,
      });

      try {
        const publishResult = await eventPublisher.publish({
          ...eventPayload,
          eventType: event.eventType,
          aggregateType: event.aggregateType,
          aggregateId: event.aggregateId,
          publishedAt: new Date().toISOString(),
        });

        await outboxEventRepository.markAsProcessed(event.id, {
          payload: {
            _deliveryAttempts: attempts,
            _publishResult: publishResult,
            _publishedAt: new Date().toISOString(),
          },
        });

        logger.info?.('[OutboxRelay] Event published', {
          eventId,
          scope,
          aggregateId: event.aggregateId,
          eventType: event.eventType,
          publishResult,
        });
      } catch (error) {
        const nextAttempt = attempts + 1;
        const shouldFail = nextAttempt >= maxDeliveryAttempts;
        const retryAfterMs = shouldFail ? null : calculateRetryDelayMs(nextAttempt, {
          baseDelayMs: baseRetryDelayMs,
          maxDelayMs: maxRetryDelayMs,
          backoffMultiplier: retryMultiplier,
          jitterMs: retryJitterMs,
        });

        const nextRetryAt = shouldFail ? null : new Date(now.getTime() + retryAfterMs);

        await outboxEventRepository.markAsFailed(event.id, error, {
          attempts: nextAttempt,
          terminal: shouldFail,
          nextRetryAt,
          extraPayload: {
            _publishResult: null,
            _scope: scope,
            _lastAttemptedAt: new Date().toISOString(),
          },
        });

        logger.error?.('[OutboxRelay] Event publish failed', {
          eventId,
          scope,
          aggregateId: event.aggregateId,
          eventType: event.eventType,
          attempts: nextAttempt,
          terminal: shouldFail,
          nextRetryAt: nextRetryAt?.toISOString(),
          error: error?.message || String(error),
        });
      }
    }
  };

  const start = (overridePollIntervalMs = pollIntervalMs) => {
    if (isRunning) {
      logger.warn('[OutboxRelay] Worker already running');
      return;
    }

    const interval = Number.isFinite(Number(overridePollIntervalMs))
      ? Number(overridePollIntervalMs)
      : pollIntervalMs;

    isRunning = true;
    logger.log(`[OutboxRelay] Starting worker with poll interval ${interval}ms`);

    processEventsInternal().catch(err => {
      logger.error?.('[OutboxRelay] Initial sync failed', { error: err?.message || String(err) });
    });

    intervalHandle = setIntervalFn(() => {
      if (isRunning) {
        processEventsInternal().catch(err => {
          logger.error?.('[OutboxRelay] Background sync failed', { error: err?.message || String(err) });
        });
      }
    }, interval);
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

  return { start, stop, processPendingEvents, calculateRetryDelayMs };
};

module.exports = { createOutboxRelayWorker };
