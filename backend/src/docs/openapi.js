const buildEndpoints = (moduleRegistry = []) => Object.fromEntries(
  moduleRegistry.map((moduleRegistration) => [moduleRegistration.name, moduleRegistration.basePath]),
);

/**
 * Build the OpenAPI document for production-critical backend surfaces.
 * The spec intentionally covers stable public contracts only; module tests
 * keep the implementation routes aligned with this document.
 *
 * @param {{ moduleRegistry?: Array<{ name: string, basePath: string }> }} [options]
 * @returns {object}
 */
const buildOpenApiDocument = ({ moduleRegistry = [] } = {}) => ({
  openapi: '3.0.3',
  info: {
    title: 'CrediCobranza API',
    version: '1.0.0',
    description: 'API operacional para créditos, pagos, fórmulas, configuración y auditoría.',
  },
  servers: [
    { url: '/api' },
  ],
  tags: [
    { name: 'Auth' },
    { name: 'Credits' },
    { name: 'Credit formulas' },
    { name: 'Config' },
    { name: 'Payments' },
    { name: 'Notifications' },
    { name: 'Audits' },
  ],
  'x-module-endpoints': buildEndpoints(moduleRegistry),
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      ErrorEnvelope: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              message: { type: 'string' },
              statusCode: { type: 'integer' },
            },
          },
        },
      },
      CreditCalculationInput: {
        type: 'object',
        required: ['amount', 'interestRate', 'termMonths'],
        properties: {
          amount: { type: 'number', minimum: 0.01 },
          interestRate: { type: 'number', minimum: 0, maximum: 100 },
          termMonths: { type: 'integer', minimum: 1, maximum: 360 },
          startDate: { type: 'string', format: 'date' },
          lateFeeMode: { type: 'string', enum: ['NONE', 'SIMPLE', 'COMPOUND', 'FLAT', 'TIERED'] },
          annualLateFeeRate: { type: 'number', minimum: 0, maximum: 100 },
          rateSource: { type: 'string', enum: ['policy', 'manual'] },
          lateFeeSource: { type: 'string', enum: ['policy', 'manual'] },
        },
      },
      PaymentMethod: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          key: { type: 'string' },
          label: { type: 'string' },
          isActive: { type: 'boolean' },
          description: { type: 'string' },
          requiresReference: { type: 'boolean' },
        },
      },
      RatePolicy: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          key: { type: 'string' },
          label: { type: 'string' },
          isActive: { type: 'boolean' },
          minAmount: { type: 'number', nullable: true },
          maxAmount: { type: 'number', nullable: true },
          annualEffectiveRate: { type: 'number', minimum: 0, maximum: 100 },
          priority: { type: 'integer' },
        },
      },
      LateFeePolicy: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          key: { type: 'string' },
          label: { type: 'string' },
          isActive: { type: 'boolean' },
          annualEffectiveRate: { type: 'number', minimum: 0, maximum: 100 },
          lateFeeMode: { type: 'string', enum: ['NONE', 'SIMPLE', 'COMPOUND', 'FLAT', 'TIERED'] },
          priority: { type: 'integer' },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Iniciar sesión',
        security: [],
        responses: {
          200: { description: 'Sesión creada' },
          401: { description: 'Credenciales inválidas', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } } },
        },
      },
    },
    '/loans/calculations': {
      post: {
        tags: ['Credits'],
        summary: 'Calcular un crédito con la fórmula activa',
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/CreditCalculationInput' } },
          },
        },
        responses: {
          200: { description: 'Cálculo generado con versión de fórmula y política aplicada' },
          400: { description: 'Parámetros inválidos', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } } },
        },
      },
    },
    '/loans': {
      get: { tags: ['Credits'], summary: 'Listar créditos', responses: { 200: { description: 'Créditos visibles para el rol' } } },
      post: { tags: ['Credits'], summary: 'Crear crédito real congelando fórmula y políticas aplicadas', responses: { 201: { description: 'Crédito creado' } } },
    },
    '/loans/{loanId}/installments/{installmentNumber}/quote': {
      get: {
        tags: ['Credits'],
        summary: 'Cotizar una cuota antes de pagar',
        parameters: [
          { name: 'loanId', in: 'path', required: true, schema: { type: 'integer' } },
          { name: 'installmentNumber', in: 'path', required: true, schema: { type: 'integer' } },
          { name: 'asOfDate', in: 'query', schema: { type: 'string', format: 'date' } },
        ],
        responses: { 200: { description: 'Cotización de cuota' } },
      },
    },
    '/loans/workbench/graph/calculations': {
      post: { tags: ['Credit formulas'], summary: 'Probar una fórmula antes de guardarla', responses: { 200: { description: 'Resultado de validación y cálculo' } } },
    },
    '/config/payment-methods': {
      get: { tags: ['Config'], summary: 'Listar métodos de pago canónicos', responses: { 200: { description: 'Métodos de pago' } } },
      post: { tags: ['Config'], summary: 'Crear método de pago', responses: { 201: { description: 'Método creado' } } },
    },
    '/config/rate-policies': {
      get: { tags: ['Config'], summary: 'Listar políticas de tasa', responses: { 200: { description: 'Políticas de tasa' } } },
      post: { tags: ['Config'], summary: 'Crear política de tasa', responses: { 201: { description: 'Política creada' } } },
    },
    '/config/late-fee-policies': {
      get: { tags: ['Config'], summary: 'Listar políticas de mora', responses: { 200: { description: 'Políticas de mora' } } },
      post: { tags: ['Config'], summary: 'Crear política de mora', responses: { 201: { description: 'Política creada' } } },
    },
    '/payments/capital': {
      post: { tags: ['Payments'], summary: 'Registrar abono a capital', responses: { 201: { description: 'Abono aplicado' } } },
    },
    '/notifications': {
      get: { tags: ['Notifications'], summary: 'Listar notificaciones', responses: { 200: { description: 'Notificaciones visibles' } } },
    },
    '/audits': {
      get: { tags: ['Audits'], summary: 'Listar auditoría operacional', responses: { 200: { description: 'Eventos auditables' } } },
    },
  },
});

module.exports = {
  buildOpenApiDocument,
};
