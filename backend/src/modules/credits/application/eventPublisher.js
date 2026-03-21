const crypto = require('crypto');

const { createOutboxEventRepository } = require('../infrastructure/outboxEventRepository');

const createEventPublisher = ({ outboxEventRepository = createOutboxEventRepository() } = {}) => {
  const publishAmortizationCalculatedEvent = async ({
    loanId,
    transactionId,
    previousBalance,
    newBalance,
    breakdown,
  }) => {
    const event = {
      aggregateType: 'LoanTransaction',
      aggregateId: transactionId,
      eventType: 'AmortizationCalculatedEvent',
      payload: {
        eventId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        eventType: 'AmortizationCalculatedEvent',
        data: {
          loanId,
          transactionId,
          previousBalance,
          newBalance,
          amortizationBreakdown: breakdown,
        },
      },
      status: 'PENDING',
    };

    return outboxEventRepository.create(event);
  };

  return { publishAmortizationCalculatedEvent };
};

module.exports = { createEventPublisher };