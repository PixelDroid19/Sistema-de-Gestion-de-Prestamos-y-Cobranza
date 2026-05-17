const { LOG_CATEGORY } = require('@/modules/shared/logCategories');

// ---------------------------------------------------------------------------
// AUTH
// ---------------------------------------------------------------------------
const AUTH_LOGIN_SUCCESS        = 'auth.login.success';
const AUTH_LOGIN_FAILED         = 'auth.login.failed';
const AUTH_ACCOUNT_LOCKED       = 'auth.account.locked';
const AUTH_LOGOUT               = 'auth.logout';
const AUTH_TOKEN_REFRESHED      = 'auth.token.refreshed';
const AUTH_PASSWORD_CHANGED     = 'auth.password.changed';

// ---------------------------------------------------------------------------
// CREDITS
// ---------------------------------------------------------------------------
const CREDIT_CREATED            = 'credit.created';
const CREDIT_APPROVED           = 'credit.approved';
const CREDIT_DISBURSED          = 'credit.disbursed';
const CREDIT_STATUS_CHANGED     = 'credit.status.changed';
const CREDIT_CLOSED             = 'credit.closed';
const INSTALLMENT_PAID          = 'credit.installment.paid';
const INSTALLMENT_OVERDUE       = 'credit.installment.overdue';
const CAPITAL_PREPAYMENT_APPLIED = 'credit.capital_prepayment.applied';
const LOAN_PAYOFF_COMPLETED     = 'credit.payoff.completed';
const CALCULATION_PROFILE_CHANGED = 'credit.calculation_profile.changed';

// ---------------------------------------------------------------------------
// PAYMENTS
// ---------------------------------------------------------------------------
const PAYMENT_RECEIVED          = 'payment.received';
const PAYMENT_APPLIED           = 'payment.applied';
const PAYMENT_REJECTED          = 'payment.rejected';
const PAYMENT_REVERSED          = 'payment.reversed';
const PAYMENT_VOUCHER_GENERATED = 'payment.voucher.generated';

// ---------------------------------------------------------------------------
// CUSTOMERS
// ---------------------------------------------------------------------------
const CUSTOMER_CREATED          = 'customer.created';
const CUSTOMER_UPDATED          = 'customer.updated';
const CUSTOMER_DEACTIVATED      = 'customer.deactivated';
const CUSTOMER_REACTIVATED      = 'customer.reactivated';
const CUSTOMER_DELETED          = 'customer.deleted';

// ---------------------------------------------------------------------------
// ASSOCIATES (Investors)
// ---------------------------------------------------------------------------
const ASSOCIATE_CREATED         = 'associate.created';
const ASSOCIATE_UPDATED         = 'associate.updated';
const ASSOCIATE_DELETED         = 'associate.deleted';
const CONTRIBUTION_ADDED        = 'associate.contribution.added';
const CONTRIBUTION_UPDATED      = 'associate.contribution.updated';
const DISTRIBUTION_PAID         = 'associate.distribution.paid';
const REINVESTMENT_APPLIED      = 'associate.reinvestment.applied';
const ASSOCIATE_INSTALLMENT_RECORDED = 'associate.installment.recorded';

// ---------------------------------------------------------------------------
// CONFIG
// ---------------------------------------------------------------------------
const RATE_POLICY_CREATED       = 'config.rate_policy.created';
const RATE_POLICY_UPDATED       = 'config.rate_policy.updated';
const RATE_POLICY_DELETED       = 'config.rate_policy.deleted';
const LATE_FEE_POLICY_CHANGED   = 'config.late_fee_policy.changed';
const PAYMENT_METHOD_CHANGED    = 'config.payment_method.changed';
const SETTING_UPDATED           = 'config.setting.updated';

// ---------------------------------------------------------------------------
// USERS
// ---------------------------------------------------------------------------
const USER_CREATED              = 'user.created';
const USER_UPDATED              = 'user.updated';
const USER_DEACTIVATED          = 'user.deactivated';
const USER_REACTIVATED          = 'user.reactivated';
const USER_UNLOCKED             = 'user.unlocked';
const PERMISSION_GRANTED        = 'user.permission.granted';
const PERMISSION_REVOKED        = 'user.permission.revoked';

// ---------------------------------------------------------------------------
// NOTIFICATIONS
// ---------------------------------------------------------------------------
const NOTIFICATION_SENT         = 'notification.sent';
const NOTIFICATION_FAILED       = 'notification.failed';
const OVERDUE_ALERT_GENERATED   = 'notification.overdue_alert.generated';
const OVERDUE_ALERT_RESOLVED    = 'notification.overdue_alert.resolved';

// ---------------------------------------------------------------------------
// SYSTEM
// ---------------------------------------------------------------------------
const SERVER_STARTED            = 'system.server.started';
const SERVER_SHUTDOWN           = 'system.server.shutdown';
const OUTBOX_EVENT_PUBLISHED    = 'system.outbox.published';
const OUTBOX_EVENT_FAILED       = 'system.outbox.failed';
const SCHEMA_SYNCED             = 'system.schema.synced';
const RATE_LIMIT_EXCEEDED       = 'system.rate_limit.exceeded';

// ---------------------------------------------------------------------------
// Grouped export for namespaced access: EVENT_TYPES.AUTH.LOGIN_SUCCESS
// ---------------------------------------------------------------------------

const EVENT_TYPES = Object.freeze({
  // Auth
  AUTH_LOGIN_SUCCESS,
  AUTH_LOGIN_FAILED,
  AUTH_ACCOUNT_LOCKED,
  AUTH_LOGOUT,
  AUTH_TOKEN_REFRESHED,
  AUTH_PASSWORD_CHANGED,

  // Credits
  CREDIT_CREATED,
  CREDIT_APPROVED,
  CREDIT_DISBURSED,
  CREDIT_STATUS_CHANGED,
  CREDIT_CLOSED,
  INSTALLMENT_PAID,
  INSTALLMENT_OVERDUE,
  CAPITAL_PREPAYMENT_APPLIED,
  LOAN_PAYOFF_COMPLETED,
  CALCULATION_PROFILE_CHANGED,

  // Payments
  PAYMENT_RECEIVED,
  PAYMENT_APPLIED,
  PAYMENT_REJECTED,
  PAYMENT_REVERSED,
  PAYMENT_VOUCHER_GENERATED,

  // Customers
  CUSTOMER_CREATED,
  CUSTOMER_UPDATED,
  CUSTOMER_DEACTIVATED,
  CUSTOMER_REACTIVATED,
  CUSTOMER_DELETED,

  // Associates
  ASSOCIATE_CREATED,
  ASSOCIATE_UPDATED,
  ASSOCIATE_DELETED,
  CONTRIBUTION_ADDED,
  CONTRIBUTION_UPDATED,
  DISTRIBUTION_PAID,
  REINVESTMENT_APPLIED,
  ASSOCIATE_INSTALLMENT_RECORDED,

  // Config
  RATE_POLICY_CREATED,
  RATE_POLICY_UPDATED,
  RATE_POLICY_DELETED,
  LATE_FEE_POLICY_CHANGED,
  PAYMENT_METHOD_CHANGED,
  SETTING_UPDATED,

  // Users
  USER_CREATED,
  USER_UPDATED,
  USER_DEACTIVATED,
  USER_REACTIVATED,
  USER_UNLOCKED,
  PERMISSION_GRANTED,
  PERMISSION_REVOKED,

  // Notifications
  NOTIFICATION_SENT,
  NOTIFICATION_FAILED,
  OVERDUE_ALERT_GENERATED,
  OVERDUE_ALERT_RESOLVED,

  // System
  SERVER_STARTED,
  SERVER_SHUTDOWN,
  OUTBOX_EVENT_PUBLISHED,
  OUTBOX_EVENT_FAILED,
  SCHEMA_SYNCED,
  RATE_LIMIT_EXCEEDED,
});

// ---------------------------------------------------------------------------
// Default category per event prefix
// ---------------------------------------------------------------------------

const EVENT_CATEGORY_MAP = Object.freeze({
  'auth.':         LOG_CATEGORY.SECURITY,
  'credit.':       LOG_CATEGORY.BUSINESS,
  'payment.':      LOG_CATEGORY.BUSINESS,
  'customer.':     LOG_CATEGORY.BUSINESS,
  'associate.':    LOG_CATEGORY.BUSINESS,
  'config.':       LOG_CATEGORY.AUDIT,
  'user.':         LOG_CATEGORY.AUDIT,
  'notification.': LOG_CATEGORY.TECHNICAL,
  'system.':       LOG_CATEGORY.TECHNICAL,
});

/**
 * Resolve the default log category for a given event type string.
 * Looks up by longest-matching prefix in EVENT_CATEGORY_MAP.
 */
const resolveEventCategory = (eventType) => {
  for (const [prefix, category] of Object.entries(EVENT_CATEGORY_MAP)) {
    if (eventType.startsWith(prefix)) {
      return category;
    }
  }
  return LOG_CATEGORY.TECHNICAL;
};

module.exports = {
  EVENT_TYPES,
  EVENT_CATEGORY_MAP,
  resolveEventCategory,
};
