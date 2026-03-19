const createApp = require('./app');
const { bootstrap } = require('./bootstrap');

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
} = {}) => {
  const bootstrapResult = await runBootstrap();
  const app = buildApp({ moduleRegistry: bootstrapResult.modules });

  return new Promise((resolve, reject) => {
    const server = app.listen(port, () => {
      console.log(`Backend server running on http://localhost:${port}`);
      resolve({ app, server, bootstrap: bootstrapResult });
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
