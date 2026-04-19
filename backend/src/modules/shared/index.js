const { createModule } = require('./contracts');
const { createAuthContext, resolveAuthContext } = require('./auth');
const { respond, success, created } = require('./http');
const { mapApplicationError } = require('./errors');
const { runWithRequestContext, getRequestContext, getCurrentRequest } = require('./requestContext');
const {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  parsePaginationQuery,
  buildPaginationMeta,
  buildPaginatedResult,
  paginateModel,
} = require('./pagination');

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
  runWithRequestContext,
  getRequestContext,
  getCurrentRequest,
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  parsePaginationQuery,
  buildPaginationMeta,
  buildPaginatedResult,
  paginateModel,
};
