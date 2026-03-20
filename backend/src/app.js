const express = require('express');
const cors = require('cors');
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

  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(logRequest);

  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'success',
      message: 'Loan Recovery System API is running',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
    });
  });

  app.get('/', (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Loan Recovery System API</title></head>
      <body style="font-family: Arial, sans-serif; padding: 2rem;">
        <h1>🏦 Loan Recovery System</h1>
        <p>Backend API server running in ${process.env.NODE_ENV || 'development'}.</p>
        <p><a href="/api">View API documentation</a></p>
      </body>
      </html>
    `);
  });

  app.get('/api', (req, res) => {
    const endpoints = Object.fromEntries(moduleRegistry.map((moduleRegistration) => [moduleRegistration.name, moduleRegistration.basePath]));

    res.json({
      message: 'Loan Recovery System API',
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
