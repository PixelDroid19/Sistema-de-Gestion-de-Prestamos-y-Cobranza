const express = require('express');
const cors = require('cors');
let helmet;
try {
  helmet = require('helmet');
} catch (e) {
  // helmet not installed
}
require('dotenv').config();

const { createSharedRuntime } = require('./bootstrap/sharedRuntime');
const { globalErrorHandler, notFoundHandler } = require('./utils/errorHandler');
const { logRequest } = require('./utils/logger');
const { buildModuleRegistry } = require('./modules');

/**
 * Create the backend HTTP application with the registered module routers.
 * @param {{ sharedRuntime?: object, moduleRegistry?: Array<{ name: string, basePath: string, router: import('express').Router }> }} [options]
 * @returns {import('express').Express}
 */
const createApp = ({
  sharedRuntime = createSharedRuntime(),
  moduleRegistry = buildModuleRegistry({ sharedRuntime }),
} = {}) => {
  const app = express();
  const { globalLimiter } = require('./middleware/rateLimiter');

  if (helmet) {
    app.use(helmet());
  }
  app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(',') || '*' }));
  app.use(globalLimiter);
  app.use(express.json({ limit: '2mb' })); // Reduced limit for better security
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));
  app.use(logRequest);

  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'success',
      message: 'CrediCobranza API is running',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
    });
  });

  app.get('/', (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>CrediCobranza API</title></head>
      <body style="font-family: Arial, sans-serif; padding: 2rem;">
        <h1>🏦 CrediCobranza</h1>
        <p>Sistema de Gestion de Prestamos y Cobranza ejecutandose en ${process.env.NODE_ENV || 'development'}.</p>
        <p><a href="/api">View API documentation</a></p>
      </body>
      </html>
    `);
  });

  app.get('/api', (req, res) => {
    const endpoints = Object.fromEntries(moduleRegistry.map((moduleRegistration) => [moduleRegistration.name, moduleRegistration.basePath]));

    res.json({
      message: 'CrediCobranza API',
      version: '1.0.0',
      endpoints,
    });
  });

  moduleRegistry.forEach((moduleRegistration) => {
    app.use(moduleRegistration.basePath, moduleRegistration.router);
  });

  app.use(notFoundHandler);
  app.use(globalErrorHandler);

  return app;
};

module.exports = createApp;
module.exports.createApp = createApp;
