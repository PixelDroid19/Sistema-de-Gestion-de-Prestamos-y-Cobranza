require('module-alias/register');
const createApp = require('./app');
const { bootstrap } = require('./bootstrap');
const { parseTcpPort } = require('./bootstrap/ports');
const { createOutboxRelayWorker } = require('./workers/outboxRelayWorker');
const { domainEventBus, EVENT_TYPES } = require('@/modules/shared/events');

const DEFAULT_PORT = 5000;
const resolveServerPort = (port = process.env.PORT || DEFAULT_PORT) => parseTcpPort('PORT', port, { allowZero: true });

/**
 * Bootstrap infrastructure, compose the Express app, and start listening.
 * @param {{ port?: number|string, bootstrap?: Function, createApp?: Function }} [options]
 * @returns {Promise<{ app: import('express').Express, server: import('http').Server, bootstrap: object }>}
 */
const startServer = async ({
  port = process.env.PORT || DEFAULT_PORT,
  bootstrap: runBootstrap = bootstrap,
  createApp: buildApp = createApp,
  createWorker = createOutboxRelayWorker,
} = {}) => {
  const listenPort = resolveServerPort(port);
  const bootstrapResult = await runBootstrap();
  const app = buildApp({
    sharedRuntime: bootstrapResult.sharedRuntime,
    moduleRegistry: bootstrapResult.modules,
  });

  const outboxWorker = createWorker();
  outboxWorker.start(5000);

  return new Promise((resolve, reject) => {
    let server;
    server = app.listen(listenPort, () => {
      console.log(`Backend server running on http://localhost:${listenPort}`);
      domainEventBus.emit(EVENT_TYPES.SERVER_STARTED, { port: listenPort });

      const shutdown = async (signal) => {
        console.log(`Received ${signal}, shutting down gracefully...`);
        domainEventBus.emit(EVENT_TYPES.SERVER_SHUTDOWN, { signal });
        outboxWorker.stop();
        server.close(() => {
          console.log('HTTP server closed');
          process.exit(0);
        });
        // Force exit after 10s if connections linger
        setTimeout(() => {
          console.error('Graceful shutdown timed out, forcing exit');
          process.exit(1);
        }, 10_000).unref();
      };

      process.on('SIGTERM', () => shutdown('SIGTERM'));
      process.on('SIGINT', () => shutdown('SIGINT'));

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
  resolveServerPort,
};
