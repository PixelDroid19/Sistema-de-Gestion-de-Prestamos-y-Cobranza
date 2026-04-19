const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { VoucherService } = require('@/modules/payouts/domain/services/VoucherService');

describe('VoucherService', () => {
  describe('formatCurrency', () => {
    test('formats positive numbers as COP currency', () => {
      const result = VoucherService.formatCurrency(100000);
      assert.ok(result.includes('100.000') || result.includes('100,000') || result.includes('100000'), 
        `Expected formatted currency, got: ${result}`);
    });

    test('formats zero as zero currency', () => {
      const result = VoucherService.formatCurrency(0);
      assert.ok(result.includes('0'), `Expected formatted zero, got: ${result}`);
    });

    test('returns $0.00 for NaN', () => {
      const result = VoucherService.formatCurrency(NaN);
      assert.equal(result, '$0.00');
    });

    test('returns $0.00 for non-number input', () => {
      const result = VoucherService.formatCurrency('invalid');
      assert.equal(result, '$0.00');
    });
  });

  describe('formatDate', () => {
    test('formats valid date as Spanish date string', () => {
      const result = VoucherService.formatDate(new Date('2026-03-15'));
      assert.ok(result.includes('2026'), `Expected year in output, got: ${result}`);
      assert.ok(result.includes('marzo') || result.includes('March'), 
        `Expected month name, got: ${result}`);
    });

    test('returns N/A for null', () => {
      const result = VoucherService.formatDate(null);
      assert.equal(result, 'N/A');
    });

    test('returns N/A for undefined', () => {
      const result = VoucherService.formatDate(undefined);
      assert.equal(result, 'N/A');
    });

    test('returns N/A for invalid date string', () => {
      const result = VoucherService.formatDate('not-a-date');
      assert.equal(result, 'N/A');
    });
  });

  describe('generateVoucherPdf', () => {
    test('generates a PDF buffer from payment, loan, and customer data', async () => {
      const payment = {
        id: 123,
        paymentDate: new Date('2026-03-15'),
        amount: 500000,
        principalApplied: 350000,
        interestApplied: 150000,
        penaltyApplied: 0,
        remainingBalanceAfterPayment: 1500000,
        installmentNumber: 5,
        paymentMetadata: {
          method: 'transfer',
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
        principalApplied: 350000,
        interestApplied: 150000,
        penaltyApplied: 50000,
        remainingBalanceAfterPayment: 1450000,
        installmentNumber: 3,
        paymentMetadata: { method: 'cash' },
      };

      const loan = { id: 10, amount: 5000000 };
      const customer = { name: 'Test Customer', documentNumber: '999', phone: '300999' };

      const result = await VoucherService.generateVoucherPdf(payment, loan, customer);

      assert.ok(Buffer.isBuffer(result));
      assert.ok(result.length > 0);
    });
  });
});
