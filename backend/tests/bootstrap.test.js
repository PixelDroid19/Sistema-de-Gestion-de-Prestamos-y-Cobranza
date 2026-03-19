const { test, mock, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const { bootstrap, validateEnvironment } = require('../src/bootstrap');
const { startServer } = require('../src/server');

afterEach(() => {
  mock.restoreAll();
});

test('validateEnvironment rejects missing required variables', () => {
  assert.throws(() => validateEnvironment({
    DB_NAME: 'lendflow',
    DB_USER: 'postgres',
    DB_PASSWORD: 'secret',
    DB_HOST: 'localhost',
    DB_PORT: '5432',
  }), /JWT_SECRET/);
});

test('bootstrap authenticates infrastructure, syncs schema, and returns module registry', async () => {
  const calls = [];
  const modules = [{ name: 'auth', basePath: '/api/auth', router: {} }];
  const scheduler = {
    async start() {
      calls.push('scheduler');
      return { started: true, intervalMs: 3600000 };
    },
  };

  const result = await bootstrap({
    env: {
      DB_NAME: 'lendflow',
      DB_USER: 'postgres',
      DB_PASSWORD: 'secret',
      DB_HOST: 'localhost',
      DB_PORT: '5432',
      JWT_SECRET: 'jwt-secret',
    },
    sequelize: {
      async authenticate() {
        calls.push('authenticate');
      },
    },
    syncSchema: async () => {
      calls.push('syncSchema');
      return { mode: 'sync', status: 'verified', tables: ['Associates', 'Loans', 'Payments'] };
    },
    buildModuleRegistry: () => {
      calls.push('modules');
      return modules;
    },
    scheduler,
  });

  assert.deepEqual(calls, ['authenticate', 'syncSchema', 'scheduler', 'modules']);
  assert.equal(result.modules, modules);
  assert.deepEqual(result.schema, { mode: 'sync', status: 'verified', tables: ['Associates', 'Loans', 'Payments'] });
  assert.deepEqual(result.overdueAlerts, { started: true, intervalMs: 3600000 });
});

test('bootstrap rejects when schema synchronization fails', async () => {
  await assert.rejects(() => bootstrap({
    env: {
      DB_NAME: 'lendflow',
      DB_USER: 'postgres',
      DB_PASSWORD: 'secret',
      DB_HOST: 'localhost',
      DB_PORT: '5432',
      JWT_SECRET: 'jwt-secret',
    },
    sequelize: {
      async authenticate() {},
    },
    syncSchema: async () => {
      throw new Error('schema sync failed');
    },
    buildModuleRegistry: () => {
      throw new Error('should not build modules after schema sync failure');
    },
  }), /schema sync failed/);
});

test('startServer refuses to listen when bootstrap fails', async () => {
  let createAppCalled = false;

  await assert.rejects(() => startServer({
    port: 0,
    bootstrap: async () => {
      throw new Error('bootstrap failed');
    },
    createApp: () => {
      createAppCalled = true;
      return {
        listen() {
          throw new Error('listen should not be called');
        },
      };
    },
  }), /bootstrap failed/);

  assert.equal(createAppCalled, false);
});
