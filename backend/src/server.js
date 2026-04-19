require('module-alias/register');
const createApp = require('./app');
const { bootstrap } = require('./bootstrap');
const { createOutboxRelayWorker } = require('./workers/outboxRelayWorker');

const PORT = process.env.PORT || 5000;

/**
 * Bootstrap infrastructure, compose the Express app, and start listening.
 * @param {{ port?: number|string, bootstrap?: Function, createApp?: Function }} [options]
 * @returns {Promise<{ app: import('express').Express, server: import('http').Server, bootstrap: object }>}
 */
const startServer = async ({
  port = PORT,
  bootstrap: runBootstrap = bootstrap,
  createApp: buildApp = createApp,
  createWorker = createOutboxRelayWorker,
} = {}) => {
  const bootstrapResult = await runBootstrap();
  const app = buildApp({
    sharedRuntime: bootstrapResult.sharedRuntime,
    moduleRegistry: bootstrapResult.modules,
  });

  const outboxWorker = createWorker();
  outboxWorker.start(5000);

  const shutdown = async () => {
    console.log('Received shutdown signal, stopping worker...');
    outboxWorker.stop();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  return new Promise((resolve, reject) => {
    let server;
    server = app.listen(port, () => {
      console.log(`Backend server running on http://localhost:${port}`);
      resolve({ app, server, bootstrap: bootstrapResult, outboxWorker });
    });

    server.on('error', reject);
  });
};

if (require.main === module) {
  startServer().catch((error) => {
    console.error('Failed to bootstrap backend:', error);
    process.exit(1);
  });
}

module.exports = {
  startServer,
};
