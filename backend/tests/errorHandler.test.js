const test = require('node:test');
const assert = require('node:assert/strict');

const {
  ValidationError,
  BusinessRuleViolationError,
  AuthenticationError,
  AuthorizationError,
  ConflictError,
  NotFoundError,
  formatErrorResponse,
  globalErrorHandler,
} = require('@/utils/errorHandler');

const captureGlobalError = (error) => {
  const response = {};
  const res = {
    status(code) {
      response.statusCode = code;
      return this;
    },
    json(payload) {
      response.body = payload;
      return this;
    },
  };

  globalErrorHandler(error, {
    path: '/api/test',
    method: 'POST',
    body: {},
    params: {},
    query: {},
  }, res, () => {});

  return response;
};

test('formatErrorResponse preserves validation field names from middleware output', () => {
  const error = new ValidationError('Corrige los errores indicados');
  error.errors = [
    {
      field: 'lateFeeMode',
      message: 'Selecciona una política de mora válida.',
      value: 'LINEAR',
    },
  ];

  const response = formatErrorResponse(error, {
    path: '/api/loans/simulations',
    method: 'POST',
  });

  assert.deepEqual(response.error.validationErrors, [
    {
      field: 'lateFeeMode',
      message: 'Selecciona una política de mora válida.',
      value: 'LINEAR',
    },
  ]);
});

test('formatErrorResponse exposes business-rule codes and denial reasons', () => {
  const error = new BusinessRuleViolationError('El abono a capital no está permitido para este crédito', {
    code: 'CAPITAL_PAYMENT_NOT_ALLOWED',
    denialReasons: [{
      code: 'FINANCIAL_BLOCK',
      message: 'Manual review block active',
      blockCode: 'MANUAL_REVIEW',
    }],
  });

  const response = formatErrorResponse(error, {
    path: '/api/payments/capital',
    method: 'POST',
  });

  assert.equal(response.error.code, 'CAPITAL_PAYMENT_NOT_ALLOWED');
  assert.deepEqual(response.error.denialReasons, [{
    code: 'FINANCIAL_BLOCK',
    message: 'Manual review block active',
    blockCode: 'MANUAL_REVIEW',
  }]);
});

test('globalErrorHandler converts persistence errors to operator-facing messages', () => {
  const foreignKeyError = new Error('insert or update on table violates foreign key constraint');
  foreignKeyError.name = 'SequelizeForeignKeyConstraintError';
  const foreignKeyResponse = captureGlobalError(foreignKeyError);

  assert.equal(foreignKeyResponse.statusCode, 400);
  assert.deepEqual(foreignKeyResponse.body.error, {
    message: 'El registro relacionado no existe.',
    statusCode: 400,
  });

  const castError = new Error('Cast to ObjectId failed');
  castError.name = 'CastError';
  const castResponse = captureGlobalError(castError);

  assert.equal(castResponse.statusCode, 400);
  assert.deepEqual(castResponse.body.error, {
    message: 'El identificador recibido no es válido.',
    statusCode: 400,
  });
});

test('globalErrorHandler converts token errors to operational session messages', () => {
  const invalidTokenError = new Error('jwt malformed');
  invalidTokenError.name = 'JsonWebTokenError';
  const invalidTokenResponse = captureGlobalError(invalidTokenError);

  assert.equal(invalidTokenResponse.statusCode, 401);
  assert.deepEqual(invalidTokenResponse.body.error, {
    message: 'La sesión no es válida. Inicia sesión de nuevo.',
    statusCode: 401,
  });

  const expiredTokenError = new Error('jwt expired');
  expiredTokenError.name = 'TokenExpiredError';
  const expiredTokenResponse = captureGlobalError(expiredTokenError);

  assert.equal(expiredTokenResponse.statusCode, 401);
  assert.deepEqual(expiredTokenResponse.body.error, {
    message: 'La sesión expiró. Inicia sesión de nuevo.',
    statusCode: 401,
  });
});

test('shared operational error defaults are Spanish and operator-facing', () => {
  assert.equal(new AuthenticationError().message, 'La autenticación es requerida.');
  assert.equal(new AuthorizationError().message, 'No tienes acceso a esta acción.');
  assert.equal(new ConflictError().message, 'El registro tiene un conflicto con la información existente.');
});

test('globalErrorHandler hides technical fallback errors behind Spanish messages', () => {
  const corsError = new Error('Origin https://example.com is not allowed by CORS policy');
  const corsResponse = captureGlobalError(corsError);

  assert.equal(corsResponse.statusCode, 403);
  assert.deepEqual(corsResponse.body.error, {
    message: 'El origen de la solicitud no está permitido.',
    statusCode: 403,
  });

  const missingOriginResponse = captureGlobalError(new Error('Origin header is required'));

  assert.equal(missingOriginResponse.statusCode, 403);
  assert.deepEqual(missingOriginResponse.body.error, {
    message: 'El origen de la solicitud es requerido.',
    statusCode: 403,
  });

  const internalResponse = captureGlobalError(new Error('database socket exploded'));

  assert.equal(internalResponse.statusCode, 500);
  assert.deepEqual(internalResponse.body.error, {
    message: 'Ocurrió un error interno del servidor.',
    statusCode: 500,
  });
});

test('NotFoundError renders known resources with operator-facing labels', () => {
  assert.equal(new NotFoundError('Customer').message, 'El cliente no existe.');
  assert.equal(new NotFoundError('Loan').message, 'El crédito no existe.');
  assert.equal(new NotFoundError('Attachment file').message, 'El archivo adjunto no existe.');
  assert.equal(new NotFoundError('UnknownResource').message, 'El registro solicitado no existe.');
});
