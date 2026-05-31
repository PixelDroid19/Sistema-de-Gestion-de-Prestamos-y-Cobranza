const { test } = require('node:test');
const assert = require('node:assert/strict');

const { createCreditPolicyResolver } = require('@/modules/credits/application/creditPolicyResolver');
const { ConflictError, ValidationError } = require('@/utils/errorHandler');

const createConfigRepository = () => ({
  async listActiveByCategory(category) {
    if (category === 'rate_policy') {
      return [
        {
          id: 10,
          key: 'standard',
          label: 'Tasa estándar',
          isActive: true,
          value: {
            minAmount: 0,
            maxAmount: null,
            annualEffectiveRate: 48,
            priority: 'medium',
          },
        },
      ];
    }

    if (category === 'late_fee_policy') {
      return [
        {
          id: 20,
          key: 'mora-simple',
          label: 'Mora simple',
          isActive: true,
          value: {
            annualEffectiveRate: 30,
            lateFeeMode: 'SIMPLE',
            priority: 'medium',
          },
        },
      ];
    }

    return [];
  },
});

test('credit policy resolver applies active policies when the caller marks fields as policy-driven', async () => {
  const resolver = createCreditPolicyResolver({ configRepository: createConfigRepository() });

  const result = await resolver.resolve({
    input: {
      amount: 2000000,
      interestRate: 60,
      termMonths: 12,
      lateFeeMode: 'COMPOUND',
      rateSource: 'policy',
      lateFeeSource: 'policy',
    },
  });

  assert.equal(result.calculationInput.interestRate, 48);
  assert.equal(result.calculationInput.lateFeeMode, 'SIMPLE');
  assert.equal(result.calculationInput.annualLateFeeRate, 30);
  assert.equal(result.policySnapshot.ratePolicyId, 10);
  assert.equal(result.policySnapshot.lateFeePolicyId, 20);
  assert.equal(result.policySnapshot.rateSource, 'policy');
  assert.equal(result.policySnapshot.lateFeeSource, 'policy');
});

test('credit policy resolver preserves explicit manual operator values and still traces available policies', async () => {
  const resolver = createCreditPolicyResolver({ configRepository: createConfigRepository() });

  const result = await resolver.resolve({
    input: {
      amount: 2000000,
      interestRate: 42,
      termMonths: 12,
      lateFeeMode: 'COMPOUND',
      annualLateFeeRate: 12,
      rateSource: 'manual',
      lateFeeSource: 'manual',
    },
  });

  assert.equal(result.calculationInput.interestRate, 42);
  assert.equal(result.calculationInput.lateFeeMode, 'COMPOUND');
  assert.equal(result.calculationInput.annualLateFeeRate, 12);
  assert.equal(result.policySnapshot.ratePolicyId, 10);
  assert.equal(result.policySnapshot.lateFeePolicyId, 20);
  assert.equal(result.policySnapshot.rateSource, 'manual');
  assert.equal(result.policySnapshot.lateFeeSource, 'manual');
});

test('credit policy resolver fails clearly when a policy-driven credit has no active rate policy', async () => {
  const resolver = createCreditPolicyResolver({
    configRepository: {
      async listActiveByCategory() {
        return [];
      },
    },
  });

  await assert.rejects(
    () => resolver.resolve({ input: { amount: 2000000, termMonths: 12, rateSource: 'policy' } }),
    (error) => error instanceof ValidationError
      && error.message === 'No hay una política de tasa activa para el monto del crédito.',
  );
});

test('credit policy resolver fails clearly when a policy-driven credit has no active late-fee policy', async () => {
  const resolver = createCreditPolicyResolver({
    configRepository: {
      async listActiveByCategory(category) {
        if (category === 'rate_policy') {
          return [
            {
              id: 10,
              key: 'standard',
              label: 'Tasa estándar',
              isActive: true,
              value: {
                minAmount: 0,
                maxAmount: null,
                annualEffectiveRate: 48,
                priority: 'medium',
              },
            },
          ];
        }

        return [];
      },
    },
  });

  await assert.rejects(
    () => resolver.resolve({
      input: {
        amount: 2000000,
        termMonths: 12,
        rateSource: 'policy',
        lateFeeSource: 'policy',
      },
    }),
    (error) => error instanceof ValidationError && error.message === 'No hay una política de mora activa.',
  );
});

test('credit policy resolver rejects ambiguous late-fee policies before calculating a credit', async () => {
  const resolver = createCreditPolicyResolver({
    configRepository: {
      async listActiveByCategory(category) {
        if (category === 'rate_policy') {
          return [
            {
              id: 10,
              key: 'standard',
              label: 'Tasa estándar',
              isActive: true,
              value: {
                minAmount: 0,
                maxAmount: null,
                annualEffectiveRate: 48,
                priority: 'medium',
              },
            },
          ];
        }

        if (category === 'late_fee_policy') {
          return [
            {
              id: 20,
              key: 'mora-a',
              label: 'Mora A',
              isActive: true,
              value: { annualEffectiveRate: 24, lateFeeMode: 'SIMPLE', priority: 'medium' },
            },
            {
              id: 21,
              key: 'mora-b',
              label: 'Mora B',
              isActive: true,
              value: { annualEffectiveRate: 30, lateFeeMode: 'COMPOUND', priority: 'medium' },
            },
          ];
        }

        return [];
      },
    },
  });

  await assert.rejects(
    () => resolver.resolve({
      input: {
        amount: 2000000,
        termMonths: 12,
        rateSource: 'policy',
        lateFeeSource: 'policy',
      },
    }),
    (error) => error instanceof ConflictError
      && error.message === 'Las políticas de mora activas no pueden compartir la misma prioridad.',
  );
});
