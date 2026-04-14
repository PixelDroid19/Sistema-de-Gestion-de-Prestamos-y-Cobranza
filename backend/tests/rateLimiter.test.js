const test = require('node:test');
const assert = require('node:assert/strict');

const { sequelize, RateLimitEntry } = require('../src/models');
const { createSqlRateLimiter } = require('../src/middleware/rateLimiter');

test('models index registers RateLimitEntry so SQL-backed rate limiting can activate', () => {
  assert.equal(sequelize.models.RateLimitEntry, RateLimitEntry);
});

test('createSqlRateLimiter uses canonical keyPrefix column names and reads select rows correctly', async () => {
  const executedSql = [];
  const queryReplacements = [];
  const originalTransaction = sequelize.transaction;
  const originalQuery = sequelize.query;

  sequelize.transaction = async (handler) => handler({ id: 'tx' });
  sequelize.query = async (sql, options = {}) => {
    executedSql.push(sql);
    queryReplacements.push(options.replacements || {});

    if (sql.includes('SELECT COUNT(*)')) {
      return [{ count: '0' }];
    }

    if (sql.includes('SELECT created_at')) {
      return [{ created_at: new Date('2026-04-14T00:00:00.000Z') }];
    }

    return [];
  };

  try {
    const limiter = createSqlRateLimiter({
      windowMs: 60_000,
      max: 3,
      keyPrefix: 'payment',
      message: 'Rate limit reached',
    });

    let nextCalled = false;
    const responseHeaders = {};
    const req = {
      ip: '127.0.0.1',
      headers: {},
      connection: {},
    };
    const res = {
      set(name, value) {
        responseHeaders[name] = value;
      },
      status() {
        throw new Error('status should not be called for an allowed request');
      },
    };

    await limiter(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.equal(responseHeaders['X-RateLimit-Limit'], 3);
    assert.equal(responseHeaders['X-RateLimit-Remaining'], 2);
    assert.equal(executedSql.some((sql) => sql.includes('"keyPrefix"')), true);
    assert.equal(executedSql.some((sql) => sql.includes('key_prefix')), false);
    assert.equal(queryReplacements.some((replacements) => replacements.windowStart instanceof Date), true);
  } finally {
    sequelize.transaction = originalTransaction;
    sequelize.query = originalQuery;
  }
});
