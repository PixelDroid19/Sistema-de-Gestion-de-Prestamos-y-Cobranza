const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const { createPayoutsRouter } = require('@/modules/payouts/presentation/router');
const { globalErrorHandler, NotFoundError } = require('@/utils/errorHandler');
const { closeServer, listen } = require('./helpers/http');

let activeServer;

afterEach(async () => {
  await closeServer(activeServer);
  activeServer = null;
});

const allowAuth = () => (req, res, next) => {
  req.user = {
    id: 3,
    role: req.headers['x-test-role'] || 'admin',
  };
  next();
};

const paymentValidation = {
  create(req, res, next) {
    next();
  },
};

const noopAttachmentUpload = {
  single() {
    return (req, res, next) => {
      req.file = {
        path: '/tmp/payment-proof.pdf',
        filename: 'payment-proof.pdf',
        originalname: 'Payment Proof.pdf',
        mimetype: 'application/pdf',
        size: 512,
      };
      req.body = { customerVisible: 'true' };
      next();
    };
  },
};

const unexpectedUseCase = (name) => async () => {
  throw new Error(`${name} should not be called`);
};

// Helper to make raw HTTP requests and get headers
const requestRaw = (server, { method = 'GET', path = '/', headers = {} } = {}) => new Promise((resolve, reject) => {
  const { port } = server.address();

  const request = http.request({
    hostname: '127.0.0.1',
    port,
    method,
    path,
    headers: {
      ...headers,
    },
  }, (response) => {
    const chunks = [];
    response.on('data', (chunk) => chunks.push(chunk));
    response.on('end', () => {
      resolve({
        statusCode: response.statusCode,
        headers: response.headers,
        body: Buffer.concat(chunks),
      });
    });
  });

  request.on('error', reject);
  request.end();
});

const http = require('node:http');

test('GET /:paymentId/voucher/pdf returns correct Content-Type and Content-Disposition headers', async () => {
  const pdfBuffer = Buffer.from('%PDF-1.4 test content');
  
  const router = createPayoutsRouter({
    authMiddleware: allowAuth,
    attachmentUpload: noopAttachmentUpload,
    paymentValidation,
    useCases: {
      listPayments: unexpectedUseCase('listPayments'),
      createPayment: unexpectedUseCase('createPayment'),
      createPartialPayment: unexpectedUseCase('createPartialPayment'),
      createCapitalPayment: unexpectedUseCase('createCapitalPayment'),
      annulInstallment: unexpectedUseCase('annulInstallment'),
      updatePaymentMetadata: unexpectedUseCase('updatePaymentMetadata'),
      listPaymentsByLoan: unexpectedUseCase('listPaymentsByLoan'),
      listPaymentDocuments: unexpectedUseCase('listPaymentDocuments'),
      uploadPaymentDocument: unexpectedUseCase('uploadPaymentDocument'),
      downloadPaymentDocument: unexpectedUseCase('downloadPaymentDocument'),
      async getPaymentVoucher({ paymentId }) {
        return {
          buffer: pdfBuffer,
          paymentId: paymentId,
          filename: `voucher-${paymentId}.pdf`,
        };
      },
    },
  });

  const app = express();
  app.use(express.json());
  app.use(router);
  app.use(globalErrorHandler);

  activeServer = await listen(app);

  const response = await requestRaw(activeServer, {
    method: 'GET',
    path: '/123/voucher/pdf',
    headers: {
      authorization: 'Bearer valid-token',
      'x-test-role': 'admin',
    },
  });

  assert.equal(response.statusCode, 200, `Expected 200, got ${response.statusCode}`);
  
  const contentType = response.headers['content-type'];
  assert.ok(contentType?.includes('application/pdf'), 
    `Expected Content-Type to be application/pdf, got: ${contentType}`);
  
  const contentDisposition = response.headers['content-disposition'];
  assert.ok(contentDisposition?.includes('attachment'), 
    `Expected Content-Disposition to include attachment, got: ${contentDisposition}`);
  assert.ok(contentDisposition?.includes('voucher-123.pdf'), 
    `Expected Content-Disposition to include filename, got: ${contentDisposition}`);
});

test('GET /:paymentId/voucher/pdf returns 404 when payment not found', async () => {
  const router = createPayoutsRouter({
    authMiddleware: allowAuth,
    attachmentUpload: noopAttachmentUpload,
    paymentValidation,
    useCases: {
      listPayments: unexpectedUseCase('listPayments'),
      createPayment: unexpectedUseCase('createPayment'),
      createPartialPayment: unexpectedUseCase('createPartialPayment'),
      createCapitalPayment: unexpectedUseCase('createCapitalPayment'),
      annulInstallment: unexpectedUseCase('annulInstallment'),
      updatePaymentMetadata: unexpectedUseCase('updatePaymentMetadata'),
      listPaymentsByLoan: unexpectedUseCase('listPaymentsByLoan'),
      listPaymentDocuments: unexpectedUseCase('listPaymentDocuments'),
      uploadPaymentDocument: unexpectedUseCase('uploadPaymentDocument'),
      downloadPaymentDocument: unexpectedUseCase('downloadPaymentDocument'),
      async getPaymentVoucher() {
        throw new NotFoundError('Payment');
      },
    },
  });

  const app = express();
  app.use(express.json());
  app.use(router);
  app.use(globalErrorHandler);

  activeServer = await listen(app);

  const response = await requestJson(activeServer, {
    method: 'GET',
    path: '/999/voucher/pdf',
    headers: {
      authorization: 'Bearer valid-token',
      'x-test-role': 'admin',
    },
  });

  assert.equal(response.statusCode, 404, `Expected 404, got ${response.statusCode}`);
  assert.equal(response.body?.error?.message, 'Payment not found');
});

const requestJson = (server, { method = 'GET', path = '/', headers = {}, body } = {}) => new Promise((resolve, reject) => {
  const payload = body === undefined ? null : JSON.stringify(body);
  const { port } = server.address();

  const request = http.request({
    hostname: '127.0.0.1',
    port,
    method,
    path,
    headers: {
      ...(payload ? {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(payload),
      } : {}),
      ...headers,
    },
  }, (response) => {
    let rawBody = '';
    response.setEncoding('utf8');
    response.on('data', (chunk) => {
      rawBody += chunk;
    });
    response.on('end', () => {
      resolve({
        statusCode: response.statusCode,
        headers: response.headers,
        body: rawBody ? JSON.parse(rawBody) : null,
      });
    });
  });

  request.on('error', reject);

  if (payload) {
    request.write(payload);
  }

  request.end();
});
