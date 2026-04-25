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
const { runWithRequestContext } = require('./modules/shared/requestContext');

/**
 * Create the backend HTTP application with the registered module routers.
 * @param {{ sharedRuntime?: object, moduleRegistry?: Array<{ name: string, basePath: string, router: import('express').Router }> }} [options]
 * @returns {import('express').Express}
 */
const createApp = ({
  sharedRuntime = createSharedRuntime(),
  moduleRegistry = buildModuleRegistry({ sharedRuntime }),
  rateLimiters = {},
} = {}) => {
  const app = express();
  const defaultRateLimiters = require('./middleware/rateLimiter');
  const effectiveRateLimiters = {
    ...defaultRateLimiters,
    ...rateLimiters,
  };
  const {
    globalLimiter,
    readLimiter = globalLimiter,
    isReadOnlyRequest = () => false,
    shouldBypassGlobalRateLimit = () => false,
  } = effectiveRateLimiters;

  if (helmet) {
    app.use(helmet());
  }

  // CORS configuration - use explicit whitelist only, never allow wildcard '*'
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').filter(Boolean) || [];
  
  if (allowedOrigins.length === 0) {
    // In development without ALLOWED_ORIGINS, only allow localhost
    if (process.env.NODE_ENV === 'development') {
      allowedOrigins.push('http://localhost:3000');
      allowedOrigins.push('http://127.0.0.1:3000');
    } else {
      // In production, require explicit ALLOWED_ORIGINS configuration
      console.warn('WARNING: CORS is configured with no allowed origins. Set ALLOWED_ORIGINS environment variable.');
    }
  }

  const corsOptions = {
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) {
        return callback(null, true);
      }
      
      // Check if origin is in whitelist
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      
      // Reject origins not in whitelist
      callback(new Error(`Origin ${origin} is not allowed by CORS policy`));
    },
    credentials: true, // Allow cookies and authentication headers
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  };

  app.use(cors(corsOptions));
  app.use((req, res, next) => {
    if (shouldBypassGlobalRateLimit(req)) {
      next();
      return;
    }

    if (isReadOnlyRequest(req)) {
      readLimiter(req, res, next);
      return;
    }

    globalLimiter(req, res, next);
  });
  app.use((req, res, next) => runWithRequestContext({ req, res }, next));
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
