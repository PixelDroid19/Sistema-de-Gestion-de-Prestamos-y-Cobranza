const test = require('node:test');
const assert = require('node:assert/strict');

const { sequelize, RateLimitEntry } = require('@/models');
const { buildRateLimitIdentifier, createInMemoryRateLimiter, createSqlRateLimiter, resolveClientIp } = require('@/middleware/rateLimiter');

test('models index registers RateLimitEntry so SQL-backed rate limiting can activate', () => {
  assert.equal(sequelize.models.RateLimitEntry, RateLimitEntry);
});

test('RateLimitEntry indexes use actual sync column names for field-mapped timestamps', () => {
  assert.deepEqual(
    RateLimitEntry.options.indexes.map((index) => index.fields),
    [
      ['keyPrefix', 'identifier', 'created_at'],
      ['keyPrefix', 'created_at'],
    ]
  );
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

test('buildRateLimitIdentifier uses first forwarded IP when present', () => {
  assert.equal(
    resolveClientIp({
      headers: { 'x-forwarded-for': '203.0.113.10, 10.0.0.8' },
      socket: { remoteAddress: '172.19.0.1' },
      connection: { remoteAddress: '172.19.0.1' },
    }),
    '203.0.113.10'
  );
});

test('buildRateLimitIdentifier scopes auth login attempts by ip and identifier', () => {
  assert.equal(
    buildRateLimitIdentifier({
      headers: {},
      ip: '127.0.0.1',
      body: { email: 'QA.Customer@example.com ' },
    }, 'auth'),
    '127.0.0.1:qa.customer@example.com'
  );
});

test('buildRateLimitIdentifier falls back to ip for non-auth limiters', () => {
  assert.equal(
    buildRateLimitIdentifier({
      headers: {},
      socket: { remoteAddress: '127.0.0.1' },
      body: { email: 'qa.customer@example.com' },
    }, 'payment'),
    '127.0.0.1'
  );
});

test('createInMemoryRateLimiter scopes auth attempts by login identifier', () => {
  const limiter = createInMemoryRateLimiter({
    windowMs: 60_000,
    max: 1,
    keyPrefix: 'auth',
  });

  const responseFactory = () => ({
    statusCode: null,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.payload = body;
      return this;
    },
  });

  let firstNextCalled = false;
  limiter(
    { ip: '127.0.0.1', headers: {}, body: { email: 'first@example.com' } },
    responseFactory(),
    () => { firstNextCalled = true; }
  );

  let secondNextCalled = false;
  limiter(
    { ip: '127.0.0.1', headers: {}, body: { email: 'second@example.com' } },
    responseFactory(),
    () => { secondNextCalled = true; }
  );

  assert.equal(firstNextCalled, true);
  assert.equal(secondNextCalled, true);
});
