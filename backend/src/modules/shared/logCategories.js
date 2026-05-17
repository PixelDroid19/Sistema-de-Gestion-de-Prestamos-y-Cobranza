/** Semantic log categories — each maps to distinct storage, retention, and alerting policies. */
const LOG_CATEGORY = Object.freeze({
  /** Errors, latency, DB failures, timeouts, infrastructure issues. */
  TECHNICAL: 'technical',
  /** Financial and operational domain events (credit, payment, associate, customer). */
  BUSINESS: 'business',
  /** Access, authentication, anomalies, suspicious behaviour. */
  SECURITY: 'security',
  /** Compliance-critical mutations: approvals, disbursements, rate/config changes. */
  AUDIT: 'audit',
});

/** Granular severity levels — superset of Winston levels for domain-aware alerting. */
const LOG_SEVERITY = Object.freeze({
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
  /** Reserved for financial compliance and incident-grade events. */
  CRITICAL: 'critical',
});

module.exports = { LOG_CATEGORY, LOG_SEVERITY };
