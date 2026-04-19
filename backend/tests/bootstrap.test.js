const { test, mock, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const { bootstrap, validateEnvironment } = require('@/bootstrap');
const { startServer } = require('@/server');

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

test('validateEnvironment rejects insecure default JWT secret in production', () => {
  assert.throws(() => validateEnvironment({
    DB_NAME: 'lendflow',
    DB_USER: 'postgres',
    DB_PASSWORD: 'secret',
    DB_HOST: 'localhost',
    DB_PORT: '5432',
    JWT_SECRET: 'changeme',
    NODE_ENV: 'production',
  }), /insecure default value/i);
});

test('validateEnvironment allows insecure default JWT secret outside production', () => {
  assert.doesNotThrow(() => validateEnvironment({
    DB_NAME: 'lendflow',
    DB_USER: 'postgres',
    DB_PASSWORD: 'secret',
    DB_HOST: 'localhost',
    DB_PORT: '5432',
    JWT_SECRET: 'changeme',
    NODE_ENV: 'development',
  }));
});

test('validateEnvironment rejects too-short JWT secrets in production', () => {
  assert.throws(() => validateEnvironment({
    DB_NAME: 'lendflow',
    DB_USER: 'postgres',
    DB_PASSWORD: 'secret',
    DB_HOST: 'localhost',
    DB_PORT: '5432',
    JWT_SECRET: 'short-secret',
    NODE_ENV: 'production',
  }), /at least 32 characters/i);
});

test('bootstrap authenticates infrastructure, syncs schema, and returns module registry', async () => {
  const calls = [];
  const modules = [{ name: 'auth', basePath: '/api/auth', router: {} }];
  const sharedRuntime = { id: 'runtime-1' };
  const seedResult = { seededProducts: 3, seededGraphs: 3 };
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
      return { mode: 'verify', status: 'verified', tables: ['Associates', 'Loans', 'Payments'] };
    },
    seedFinancialProducts: async () => {
      calls.push('seedFinancialProducts');
      return seedResult;
    },
    createSharedRuntime: () => {
      calls.push('sharedRuntime');
      return sharedRuntime;
    },
    buildModuleRegistry: ({ sharedRuntime: injectedRuntime }) => {
      calls.push('modules');
      assert.equal(injectedRuntime, sharedRuntime);
      return modules;
    },
    scheduler,
  });

  assert.deepEqual(calls, ['authenticate', 'syncSchema', 'seedFinancialProducts', 'sharedRuntime', 'scheduler', 'modules']);
  assert.equal(result.modules, modules);
  assert.equal(result.sharedRuntime, sharedRuntime);
  assert.deepEqual(result.schema, { mode: 'verify', status: 'verified', tables: ['Associates', 'Loans', 'Payments'] });
  assert.deepEqual(result.overdueAlerts, { started: true, intervalMs: 3600000 });
});

test('startServer passes bootstrap shared runtime into app composition', async () => {
  const sharedRuntime = { id: 'runtime-2' };
  const modules = [{ name: 'auth', basePath: '/api/auth', router: {} }];
  const listenCalls = [];
  const server = {
    close(callback) {
      callback?.();
    },
    on() {},
  };

  const result = await startServer({
    port: 0,
    bootstrap: async () => ({
      sharedRuntime,
      modules,
    }),
    createApp: ({ sharedRuntime: injectedRuntime, moduleRegistry }) => {
      assert.equal(injectedRuntime, sharedRuntime);
      assert.equal(moduleRegistry, modules);
      return {
        listen(port, onListen) {
          listenCalls.push(port);
          process.nextTick(onListen);
          return server;
        },
      };
    },
    createWorker: () => ({ start() {}, stop() {} }),
  });

  assert.deepEqual(listenCalls, [0]);
  result.server.close();
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
