const { EVENT_TYPES, EVENT_CATEGORY_MAP, resolveEventCategory } = require('./eventTypes');
const { DomainEventBus, domainEventBus } = require('./domainEventBus');
const { wireEventLogger } = require('./eventLogger');
const { wireEventAuditBridge } = require('./eventAuditBridge');
const { LOG_CATEGORY, LOG_SEVERITY } = require('@/modules/shared/logCategories');

module.exports = {
  // Event types catalog
  EVENT_TYPES,
  EVENT_CATEGORY_MAP,
  resolveEventCategory,

  // Event bus (singleton + class for testing)
  DomainEventBus,
  domainEventBus,

  // Wiring helpers — call once at bootstrap
  wireEventLogger,
  wireEventAuditBridge,

  // Re-export categories for convenience
  LOG_CATEGORY,
  LOG_SEVERITY,
};
