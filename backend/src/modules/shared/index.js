const { createModule } = require('./contracts');
const { createAuthContext, resolveAuthContext } = require('./auth');
const { respond, success, created } = require('./http');
const { mapApplicationError } = require('./errors');

/**
 * Re-export shared module helpers used by feature entrypoints and routers.
 */
module.exports = {
  createModule,
  createAuthContext,
  resolveAuthContext,
  respond,
  success,
  created,
  mapApplicationError,
};
