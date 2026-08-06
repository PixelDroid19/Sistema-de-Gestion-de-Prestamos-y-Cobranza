const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { VoucherService } = require('@/modules/payouts/domain/services/VoucherService');

describe('VoucherService', () => {
  describe('formatCurrency', () => {
    test('formats positive numbers as COP currency', () => {
      const result = VoucherService.formatCurrency(100000);
      assert.equal(result, 'COP 100.000,00');
    });

    test('formats zero as zero currency', () => {
      const result = VoucherService.formatCurrency(0);
      assert.equal(result, 'COP 0,00');
    });

    test('returns explicit COP zero for NaN', () => {
      const result = VoucherService.formatCurrency(NaN);
      assert.equal(result, 'COP 0,00');
    });

    test('returns explicit COP zero for non-number input', () => {
      const result = VoucherService.formatCurrency('invalid');
      assert.equal(result, 'COP 0,00');
    });
  });

  describe('formatDate', () => {
    test('formats valid date as Spanish date string', () => {
      const result = VoucherService.formatDate(new Date('2026-03-15'));
      assert.ok(result.includes('2026'), `Expected year in output, got: ${result}`);
      assert.ok(result.includes('marzo') || result.includes('March'), 
        `Expected month name, got: ${result}`);
    });

    test('returns a clear label for null', () => {
      const result = VoucherService.formatDate(null);
      assert.equal(result, 'Sin fecha');
    });

    test('returns a clear label for undefined', () => {
      const result = VoucherService.formatDate(undefined);
      assert.equal(result, 'Sin fecha');
    });

    test('returns a clear label for invalid date string', () => {
      const result = VoucherService.formatDate('not-a-date');
      assert.equal(result, 'Sin fecha');
    });

    test('keeps date-only payment strings on the same calendar day', () => {
      const result = VoucherService.formatDate('2026-05-21');
      assert.match(result, /21/);
      assert.match(result, /2026/);
    });

    test('keeps UTC midnight payment timestamps on the same operational day', () => {
      const result = VoucherService.formatDate('2026-06-01T00:00:00.000Z');
      assert.match(result, /1/);
      assert.match(result, /junio|June/);
      assert.match(result, /2026/);
    });
  });

  describe('formatPaymentMethod', () => {
    test('renders canonical payment method keys as Spanish labels', () => {
      assert.equal(VoucherService.formatPaymentMethod('cash'), 'Efectivo');
      assert.equal(VoucherService.formatPaymentMethod('transfer'), 'Transferencia');
      assert.equal(VoucherService.formatPaymentMethod('bank_transfer'), 'Transferencia bancaria');
    });
  });

  describe('formatPaymentType', () => {
    test('identifies the operation represented by the voucher', () => {
      assert.equal(VoucherService.formatPaymentType('installment'), 'Pago de cuota');
      assert.equal(VoucherService.formatPaymentType('capital'), 'Abono a capital');
      assert.equal(VoucherService.formatPaymentType('payoff'), 'Pago total');
    });

    test('uses an explicit label for legacy or unknown payment types', () => {
      assert.equal(VoucherService.formatPaymentType(), 'Pago registrado');
      assert.equal(VoucherService.formatPaymentType('unknown'), 'Pago registrado');
    });
  });

  describe('generateVoucherPdf', () => {
    test('generates a PDF buffer from payment, loan, and customer data', async () => {
      const payment = {
        id: 123,
        paymentDate: new Date('2026-03-15'),
        amount: 500000,
        paymentMethod: 'transfer',
        principalApplied: 350000,
        interestApplied: 150000,
        penaltyApplied: 0,
        remainingBalanceAfterPayment: 1500000,
        installmentNumber: 5,
        paymentMetadata: {
          observation: 'Pago puntual',
        },
      };

      const loan = {
        id: 45,
        amount: 5000000,
      };

      const customer = {
        name: 'Juan Pérez',
        documentNumber: '12345678',
        phone: '3001234567',
      };

      const result = await VoucherService.generateVoucherPdf(payment, loan, customer);

      assert.ok(Buffer.isBuffer(result), 'Expected result to be a Buffer');
      assert.ok(result.length > 0, 'Expected non-empty buffer');

      // PDF files start with %PDF
      const header = result.slice(0, 4).toString();
      assert.equal(header, '%PDF', `Expected PDF header, got: ${header}`);
    });

    test('handles missing optional fields gracefully', async () => {
      const payment = {
        id: 1,
        paymentDate: new Date(),
        amount: 100000,
        principalApplied: 80000,
        interestApplied: 20000,
        penaltyApplied: 0,
        remainingBalanceAfterPayment: 900000,
        installmentNumber: null,
        paymentMetadata: {},
      };

      const loan = { id: 1, amount: 1000000 };
      const customer = { name: 'Test', documentNumber: null, phone: null };

      const result = await VoucherService.generateVoucherPdf(payment, loan, customer);

      assert.ok(Buffer.isBuffer(result));
      assert.ok(result.length > 0);
    });

    test('handles null customer gracefully', async () => {
      const payment = {
        id: 1,
        paymentDate: new Date(),
        amount: 100000,
        principalApplied: 80000,
        interestApplied: 20000,
        penaltyApplied: 0,
        remainingBalanceAfterPayment: 900000,
        installmentNumber: 1,
        paymentMetadata: {},
      };

      const loan = { id: 1, amount: 1000000 };

      const result = await VoucherService.generateVoucherPdf(payment, loan, null);

      assert.ok(Buffer.isBuffer(result));
      assert.ok(result.length > 0);
    });

    test('handles late fee in payment', async () => {
      const payment = {
        id: 99,
        paymentDate: new Date('2026-03-15'),
        amount: 550000,
        paymentMethod: 'cash',
        principalApplied: 350000,
        interestApplied: 150000,
        penaltyApplied: 50000,
        remainingBalanceAfterPayment: 1450000,
        installmentNumber: 3,
        paymentMetadata: {},
      };

      const loan = { id: 10, amount: 5000000 };
      const customer = { name: 'Test Customer', documentNumber: '999', phone: '300999' };

      const result = await VoucherService.generateVoucherPdf(payment, loan, customer);

      assert.ok(Buffer.isBuffer(result));
      assert.ok(result.length > 0);
    });

    test('prints the payment purpose in the voucher payment section', () => {
      const renderedText = [];
      const doc = new Proxy({}, {
        get(_target, property) {
          if (property === 'text') {
            return (value) => {
              renderedText.push(String(value));
              return doc;
            };
          }
          return () => doc;
        },
      });

      VoucherService.renderPayment(doc, {
        paymentDate: '2026-07-28',
        paymentType: 'capital',
        installmentNumber: null,
        totalPaid: 753592,
      });

      assert.ok(renderedText.includes('Tipo de pago'));
      assert.ok(renderedText.includes('Abono a capital'));
    });
  });
});
