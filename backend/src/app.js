const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const { createSharedRuntime } = require('./bootstrap/sharedRuntime');
const { globalErrorHandler, notFoundHandler } = require('./utils/errorHandler');
const { logger, logRequest } = require('./utils/logger');
const { buildModuleRegistry } = require('./modules');
const { runWithRequestContext } = require('./modules/shared/requestContext');
const { buildOpenApiDocument } = require('./docs/openapi');

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

  app.use(helmet());

  // CORS configuration - use explicit whitelist only, never allow wildcard '*'
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  if (allowedOrigins.length === 0) {
    if (process.env.NODE_ENV === 'production') {
      logger.error('ALLOWED_ORIGINS not configured — CORS will reject all cross-origin requests in production');
    } else {
      allowedOrigins.push('http://localhost:3000');
      allowedOrigins.push('http://127.0.0.1:3000');
    }
  }

  const isDevelopmentLocalOrigin = (origin) => {
    if (process.env.NODE_ENV !== 'development') {
      return false;
    }

    try {
      const { hostname, protocol } = new URL(origin);
      return ['http:', 'https:'].includes(protocol) && ['localhost', '127.0.0.1', '::1'].includes(hostname);
    } catch (_error) {
      return false;
    }
  };

  const publicReadPaths = new Set([
    '/',
    '/health',
    '/api',
    '/api/docs/openapi.json',
  ]);

  const isPublicNoOriginRequest = (req) => (
    !req.headers.origin
    && req.method === 'GET'
    && publicReadPaths.has(req.path)
  );

  const buildCorsOptions = (req, callback) => {
    callback(null, {
      origin: (origin, originCallback) => {
        // Requests with no origin: allow in dev and allow production public read probes.
        if (!origin) {
          if (isPublicNoOriginRequest(req)) {
            return originCallback(null, true);
          }

          if (process.env.NODE_ENV === 'production') {
            return originCallback(new Error('Origin header is required'));
          }
          return originCallback(null, true);
        }

        if (allowedOrigins.includes(origin)) {
          return originCallback(null, true);
        }

        if (isDevelopmentLocalOrigin(origin)) {
          return originCallback(null, true);
        }
      
        // Reject origins not in whitelist
        originCallback(new Error(`Origin ${origin} is not allowed by CORS policy`));
      },
      credentials: true, // Allow cookies and authentication headers
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Idempotency-Key'],
    });
  };

  app.use(cors(buildCorsOptions));
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
        <p><a href="/api/docs/openapi.json">OpenAPI JSON</a></p>
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
      docs: {
        openapi: '/api/docs/openapi.json',
      },
    });
  });

  app.get('/api/docs/openapi.json', (req, res) => {
    res.json(buildOpenApiDocument({ moduleRegistry }));
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
