const crypto = require('crypto');
const { createOutboxEventRepository } = require('@/modules/credits/infrastructure/outboxEventRepository');

const parsePositiveIntegerEnv = (key, defaultValue) => {
  const raw = process.env[key];
  if (raw === undefined || raw === '') {
    return defaultValue;
  }

  const normalized = String(raw).trim();
  if (!/^[1-9]\d*$/.test(normalized)) {
    throw new Error(`${key} must be a positive integer.`);
  }

  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`${key} must be a positive integer.`);
  }

  return parsed;
};

const createHttpEventPublisher = ({
  endpointUrl = process.env.OUTBOX_WEBHOOK_URL,
  timeoutMs = parsePositiveIntegerEnv('OUTBOX_WEBHOOK_TIMEOUT_MS', 3000),
  requestInit = {},
  logger = console,
} = {}) => {
  const destination = String(endpointUrl || '').trim();
  const requestTimeoutMs = Number.isFinite(timeoutMs) && timeoutMs > 0 ? Math.round(timeoutMs) : 3000;

  const publish = async (eventPayload) => {
    if (!destination) {
      return { skipped: true, reason: 'no_destination' };
    }

    if (typeof fetch !== 'function') {
      throw new Error('Fetch API is not available in this runtime for outbox delivery');
    }

    const body = JSON.stringify(eventPayload || {});
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
    try {
      const response = await fetch(destination, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'idempotency-key': eventPayload?.eventId || '',
          ...(requestInit.headers || {}),
        },
        body,
        signal: controller.signal,
        ...requestInit,
      });

      const rawResponseText = await response.text();
      if (!response.ok) {
        throw new Error(`Outbox destination responded with ${response.status}: ${rawResponseText}`);
      }

      logger.info?.('[OutboxRelay] Event delivered', {
        destination,
        eventId: eventPayload?.eventId,
        status: response.status,
      });
      return {
        published: true,
        status: response.status,
        responseBody: rawResponseText,
      };
    } finally {
      clearTimeout(timeout);
    }
  };

  return { publish };
};

const createNoopEventPublisher = ({ logger = console } = {}) => ({
  publish: async (eventPayload) => {
    logger.debug?.('[OutboxRelay] No destination configured for outbox events', {
      eventId: eventPayload?.eventId,
    });
    return { skipped: true, reason: 'no_destination_configured' };
  },
});

const buildAmortizationPayload = ({
  loanId,
  transactionId,
  previousBalance,
  newBalance,
  breakdown,
  eventId,
}) => ({
  eventId: eventId || crypto.randomUUID(),
  timestamp: new Date().toISOString(),
  eventType: 'AmortizationCalculatedEvent',
  aggregateType: 'LoanTransaction',
  aggregateId: transactionId,
  data: {
    loanId,
    transactionId,
    previousBalance,
    newBalance,
    amortizationBreakdown: breakdown,
  },
});

const createEventPublisher = ({
  outboxEventRepository = createOutboxEventRepository(),
} = {}) => {
  const publishAmortizationCalculatedEvent = async ({
    loanId,
    transactionId,
    previousBalance,
    newBalance,
    breakdown,
    eventId = crypto.randomUUID(),
  }) => {
    const payload = buildAmortizationPayload({
      loanId,
      transactionId,
      previousBalance,
      newBalance,
      breakdown,
      eventId,
    });

    const eventRecord = {
      aggregateType: 'LoanTransaction',
      aggregateId: transactionId,
      eventType: 'AmortizationCalculatedEvent',
      payload: {
        ...payload,
        _deliveryAttempts: 0,
      },
      status: 'PENDING',
    };

    return outboxEventRepository.create(eventRecord);
  };

  return { publishAmortizationCalculatedEvent };
};

module.exports = {
  createEventPublisher,
  createHttpEventPublisher,
  createNoopEventPublisher,
  buildAmortizationPayload,
};
