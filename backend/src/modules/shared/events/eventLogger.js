const { LOG_CATEGORY, LOG_SEVERITY } = require('@/modules/shared/logCategories');

const EVENT_LOGGER_WIRED = Symbol('credicobranza.eventLoggerWired');

/**
 * Subscribe to all domain event categories and route each event to the
 * appropriate Winston log helper.  Automatically called at bootstrap.
 *
 * @param {{ domainEventBus: import('./domainEventBus').DomainEventBus }} deps
 */
const wireEventLogger = ({ domainEventBus }) => {
  if (!domainEventBus?.onCategory) {
    return () => {};
  }
  if (domainEventBus[EVENT_LOGGER_WIRED]) {
    return domainEventBus[EVENT_LOGGER_WIRED];
  }

  // Lazy-require to avoid circular: logger → requestContext → ... → eventLogger → logger
  const getLogger = () => require('@/utils/logger');

  const handler = (envelope) => {
    const { eventType, category, severity, data, userId, requestId, traceId } = envelope;
    const logger = getLogger();

    const meta = {
      eventType,
      category,
      severity,
      userId,
      requestId,
      traceId,
      ...data,
    };

    switch (category) {
    case LOG_CATEGORY.SECURITY:
      logger.logSecurity(eventType, meta);
      break;
    case LOG_CATEGORY.BUSINESS:
      logger.logBusiness(eventType, meta);
      break;
    case LOG_CATEGORY.AUDIT:
      logger.logBusiness(eventType, { ...meta, category: LOG_CATEGORY.AUDIT });
      break;
    case LOG_CATEGORY.TECHNICAL:
    default:
      if (severity === LOG_SEVERITY.ERROR || severity === LOG_SEVERITY.CRITICAL) {
        logger.logger.error(eventType, meta);
      } else {
        logger.logTechnical(eventType, meta);
      }
      break;
    }
  };

  const unsubscribers = Object.values(LOG_CATEGORY).map((cat) => domainEventBus.onCategory(cat, handler));
  const unsubscribe = () => {
    unsubscribers.forEach((unsub) => unsub?.());
    delete domainEventBus[EVENT_LOGGER_WIRED];
  };

  Object.defineProperty(domainEventBus, EVENT_LOGGER_WIRED, {
    configurable: true,
    enumerable: false,
    value: unsubscribe,
  });

  return unsubscribe;
};

module.exports = { wireEventLogger };
