const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createCreatePaymentMethod,
  createUpdatePaymentMethod,
  createDeletePaymentMethod,
  createListRatePolicies,
  createCreateRatePolicy,
  createUpdateRatePolicy,
  createDeleteRatePolicy,
  createResolveRatePolicy,
  createCreateLateFeePolicy,
  createUpdateLateFeePolicy,
  createDeleteLateFeePolicy,
  createResolveLateFeePolicy,
  createListSettings,
  createUpsertSetting,
  createListAdminCatalogs,
  createListRoles,
} = require('@/modules/config/application/useCases');
const { createConfigModule } = require('@/modules/config');
const { ConflictError, NotFoundError, ValidationError } = require('@/utils/errorHandler');

test('createCreatePaymentMethod normalizes keys and persists payment-method metadata', async () => {
  let createdPayload;

  const createPaymentMethod = createCreatePaymentMethod({
    configRepository: {
      async findByCategoryAndKey() {
        return null;
      },
      async create(payload) {
        createdPayload = payload;
        return {
          id: 41,
          ...payload,
          createdAt: '2026-03-22T00:00:00.000Z',
          updatedAt: '2026-03-22T00:00:00.000Z',
        };
      },
    },
  });

  const result = await createPaymentMethod({
    label: 'Transferencia bancaria',
    description: 'Requiere soporte bancario',
    isActive: false,
    type: 'bank_transfer',
  });

  assert.deepEqual(createdPayload, {
    category: 'payment_method',
    key: 'transferencia-bancaria',
    label: 'Transferencia bancaria',
    isActive: false,
    value: {
      description: 'Requiere soporte bancario',
      requiresReference: true,
      metadata: {
        type: 'bank_transfer',
      },
    },
  });
  assert.deepEqual(result, {
    id: 41,
    key: 'transferencia-bancaria',
    label: 'Transferencia bancaria',
    isActive: false,
    type: 'bank_transfer',
    description: 'Requiere soporte bancario',
    requiresReference: true,
    metadata: {
      type: 'bank_transfer',
    },
    createdAt: '2026-03-22T00:00:00.000Z',
    updatedAt: '2026-03-22T00:00:00.000Z',
  });
});

test('createListSettings exposes the locked COP base currency by default', async () => {
  const listSettings = createListSettings({
    configRepository: {
      async listByCategory(category) {
        assert.equal(category, 'business_setting');
        return [];
      },
    },
  });

  assert.deepEqual(await listSettings(), [{
    id: null,
    key: 'base-currency',
    label: 'Moneda base',
    value: 'COP',
    description: 'Moneda operativa fija del sistema.',
    updatedAt: null,
  }]);
});

test('config payment-method mutations reject duplicates and missing records', async () => {
  const createPaymentMethod = createCreatePaymentMethod({
    configRepository: {
      async findByCategoryAndKey() {
        return { id: 2, key: 'cash' };
      },
      async create() {
        throw new Error('create should not be called');
      },
    },
  });

  await assert.rejects(() => createPaymentMethod({ label: 'Cash', key: 'cash' }), (error) => {
    assert.ok(error instanceof ConflictError);
    assert.equal(error.message, 'Ya existe un método de pago con ese identificador operativo.');
    return true;
  });

  const updatePaymentMethod = createUpdatePaymentMethod({
    configRepository: {
      async findPaymentMethodById() {
        return null;
      },
      async findByCategoryAndKey() {
        throw new Error('findByCategoryAndKey should not be called');
      },
      async update() {
        throw new Error('update should not be called');
      },
    },
  });

  const deletePaymentMethod = createDeletePaymentMethod({
    configRepository: {
      async findPaymentMethodById() {
        return null;
      },
      async destroy() {
        throw new Error('destroy should not be called');
      },
    },
  });

  await assert.rejects(() => updatePaymentMethod(999, { label: 'Updated' }), NotFoundError);
  await assert.rejects(() => deletePaymentMethod(999), NotFoundError);
});

test('config payment methods reject duplicate labels even with different keys', async () => {
  const createPaymentMethod = createCreatePaymentMethod({
    configRepository: {
      async findByCategoryAndKey() {
        return null;
      },
      async listByCategory() {
        return [
          {
            id: 8,
            key: 'transferencia-bancaria',
            label: 'Transferencia bancaria',
            value: { metadata: { type: 'bank_transfer' } },
          },
        ];
      },
      async create() {
        throw new Error('create should not be called');
      },
    },
  });

  await assert.rejects(
    () => createPaymentMethod({ label: 'Transferencia bancaria', key: 'transferencia-bancaria-alterna' }),
    (error) => {
      assert.ok(error instanceof ConflictError);
      assert.equal(error.message, 'Ya existe un método de pago con ese nombre.');
      return true;
    },
  );
});

test('config financial policies reject duplicate labels and keys with operational messages', async () => {
  const duplicateRateByKey = createCreateRatePolicy({
    configRepository: {
      async listByCategory() {
        return [];
      },
      async findByCategoryAndKey() {
        return { id: 11, key: 'credito-estandar', label: 'Crédito estándar' };
      },
      async create() {
        throw new Error('create should not be called for duplicate rate key');
      },
    },
  });

  await assert.rejects(
    () => duplicateRateByKey({
      label: 'Crédito estándar',
      key: 'credito-estandar',
      minAmount: 0,
      maxAmount: 1000000,
      annualEffectiveRate: 36,
    }),
    (error) => {
      assert.ok(error instanceof ConflictError);
      assert.equal(error.message, 'Ya existe una política de tasa con ese identificador operativo.');
      return true;
    },
  );

  const duplicateRateByLabel = createCreateRatePolicy({
    configRepository: {
      async listByCategory() {
        return [{
          id: 12,
          key: 'credito-existente',
          label: 'Crédito existente',
          isActive: false,
          value: { minAmount: 0, maxAmount: 1000000, annualEffectiveRate: 36, priority: 'medium' },
        }];
      },
      async findByCategoryAndKey() {
        return null;
      },
      async create() {
        throw new Error('create should not be called for duplicate rate label');
      },
    },
  });

  await assert.rejects(
    () => duplicateRateByLabel({
      label: 'Crédito existente',
      key: 'credito-alterno',
      minAmount: 1000001,
      maxAmount: 2000000,
      annualEffectiveRate: 40,
    }),
    (error) => {
      assert.ok(error instanceof ConflictError);
      assert.equal(error.message, 'Ya existe una política de tasa con ese nombre.');
      return true;
    },
  );

  const duplicateLateFeeByKey = createCreateLateFeePolicy({
    configRepository: {
      async findByCategoryAndKey() {
        return { id: 21, key: 'mora-simple', label: 'Mora simple' };
      },
      async create() {
        throw new Error('create should not be called for duplicate late-fee key');
      },
    },
  });

  await assert.rejects(
    () => duplicateLateFeeByKey({
      label: 'Mora simple',
      key: 'mora-simple',
      annualEffectiveRate: 24,
      lateFeeMode: 'SIMPLE',
    }),
    (error) => {
      assert.ok(error instanceof ConflictError);
      assert.equal(error.message, 'Ya existe una política de mora con ese identificador operativo.');
      return true;
    },
  );

  const duplicateLateFeeByLabel = createCreateLateFeePolicy({
    configRepository: {
      async findByCategoryAndKey() {
        return null;
      },
      async listByCategory() {
        return [{
          id: 22,
          key: 'mora-existente',
          label: 'Mora existente',
          isActive: false,
          value: { annualEffectiveRate: 24, lateFeeMode: 'SIMPLE', priority: 'medium' },
        }];
      },
      async create() {
        throw new Error('create should not be called for duplicate late-fee label');
      },
    },
  });

  await assert.rejects(
    () => duplicateLateFeeByLabel({
      label: 'Mora existente',
      key: 'mora-alterna',
      annualEffectiveRate: 24,
      lateFeeMode: 'SIMPLE',
    }),
    (error) => {
      assert.ok(error instanceof ConflictError);
      assert.equal(error.message, 'Ya existe una política de mora con ese nombre.');
      return true;
    },
  );
});

test('config payment methods reject invalid types without exposing the type catalog', async () => {
  const createPaymentMethod = createCreatePaymentMethod({
    configRepository: {
      async create() {
        throw new Error('create should not be called');
      },
    },
  });

  await assert.rejects(
    () => createPaymentMethod({ label: 'Cripto', type: 'crypto_wallet' }),
    (error) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.message, 'Selecciona un tipo de método de pago válido.');
      assert.doesNotMatch(error.message, /cash|bank_transfer|crypto_wallet/i);
      return true;
    },
  );
});

test('config policies reject invalid priority and late-fee modes without exposing internal values', async () => {
  const createRatePolicy = createCreateRatePolicy({
    configRepository: {
      async create() {
        throw new Error('create should not be called');
      },
    },
  });

  await assert.rejects(
    () => createRatePolicy({
      label: 'Crédito inválido',
      minAmount: 0,
      maxAmount: 100000,
      annualEffectiveRate: 36,
      priority: 'urgent_internal',
    }),
    (error) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.message, 'Selecciona una prioridad válida.');
      assert.doesNotMatch(error.message, /low|medium|high|urgent_internal/i);
      return true;
    },
  );

  const createLateFeePolicy = createCreateLateFeePolicy({
    configRepository: {
      async create() {
        throw new Error('create should not be called');
      },
    },
  });

  await assert.rejects(
    () => createLateFeePolicy({
      label: 'Mora inválida',
      annualEffectiveRate: 24,
      lateFeeMode: 'SIMPLE_DAILY',
      priority: 'medium',
    }),
    (error) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.message, 'Selecciona un método de mora válido.');
      assert.doesNotMatch(error.message, /SIMPLE_DAILY|SIMPLE|COMPOUND|FLAT|TIERED/);
      return true;
    },
  );
});

test('config policies reject active duplicates that would make resolution ambiguous', async () => {
  const createRatePolicy = createCreateRatePolicy({
    configRepository: {
      async findByCategoryAndKey() {
        return null;
      },
      async listByCategory() {
        return [
          {
            id: 11,
            key: 'credito-estandar',
            label: 'Crédito estándar',
            isActive: true,
            value: {
              minAmount: 0,
              maxAmount: 5000000,
              annualEffectiveRate: 60,
              priority: 'medium',
            },
          },
        ];
      },
      async create() {
        throw new Error('create should not be called');
      },
    },
  });

  await assert.rejects(
    () => createRatePolicy({
      label: 'Crédito solapado',
      minAmount: 1000000,
      maxAmount: 2000000,
      annualEffectiveRate: 55,
      priority: 'high',
    }),
    (error) => {
      assert.ok(error instanceof ConflictError);
      assert.equal(error.message, 'Las políticas de tasa activas no pueden solaparse.');
      return true;
    },
  );

  const createLateFeePolicy = createCreateLateFeePolicy({
    configRepository: {
      async findByCategoryAndKey() {
        return null;
      },
      async listByCategory() {
        return [
          {
            id: 21,
            key: 'mora-simple',
            label: 'Mora simple',
            isActive: true,
            value: {
              annualEffectiveRate: 24,
              lateFeeMode: 'SIMPLE',
              priority: 'medium',
            },
          },
        ];
      },
      async create() {
        throw new Error('create should not be called');
      },
    },
  });

  await assert.rejects(
    () => createLateFeePolicy({
      label: 'Mora alterna',
      annualEffectiveRate: 18,
      lateFeeMode: 'SIMPLE',
      priority: 'medium',
    }),
    (error) => {
      assert.ok(error instanceof ConflictError);
      assert.equal(error.message, 'Las políticas de mora activas no pueden compartir la misma prioridad.');
      return true;
    },
  );
});

test('rate policy creation rejects a catch-all range that overlaps an existing explicit range', async () => {
  const createRatePolicy = createCreateRatePolicy({
    configRepository: {
      async findByCategoryAndKey() {
        return null;
      },
      async listByCategory() {
        return [
          {
            id: 31,
            key: 'credito-medio',
            label: 'Crédito medio',
            isActive: true,
            value: {
              minAmount: 1000000,
              maxAmount: 5000000,
              annualEffectiveRate: 61,
              priority: 'medium',
            },
          },
        ];
      },
      async create() {
        throw new Error('create should not be called for overlapping catch-all ranges');
      },
    },
  });

  await assert.rejects(
    () => createRatePolicy({
      label: 'Crédito global',
      minAmount: 0,
      maxAmount: null,
      annualEffectiveRate: 50,
      priority: 'medium',
    }),
    (error) => error instanceof ConflictError && error.message === 'Las políticas de tasa activas no pueden solaparse.',
  );
});

test('rate policy update rejects changing an existing range into a catch-all overlap', async () => {
  const existingEntry = {
    id: 32,
    key: 'credito-bajo',
    label: 'Crédito bajo',
    isActive: true,
    value: {
      minAmount: 0,
      maxAmount: 999999,
      annualEffectiveRate: 45,
      priority: 'medium',
    },
  };
  const overlappingEntry = {
    id: 33,
    key: 'credito-medio',
    label: 'Crédito medio',
    isActive: true,
    value: {
      minAmount: 1000000,
      maxAmount: 5000000,
      annualEffectiveRate: 61,
      priority: 'medium',
    },
  };

  const updateRatePolicy = createUpdateRatePolicy({
    configRepository: {
      async findByIdAndCategory() {
        return existingEntry;
      },
      async findByCategoryAndKey() {
        return existingEntry;
      },
      async listByCategory() {
        return [existingEntry, overlappingEntry];
      },
      async update() {
        throw new Error('update should not be called for overlapping catch-all ranges');
      },
    },
  });

  await assert.rejects(
    () => updateRatePolicy(existingEntry.id, {
      label: 'Crédito bajo',
      minAmount: 0,
      maxAmount: null,
      annualEffectiveRate: 45,
      priority: 'medium',
    }),
    (error) => error instanceof ConflictError && error.message === 'Las políticas de tasa activas no pueden solaparse.',
  );
});

test('config financial policies reject exponent notation in rates and amount ranges', async () => {
  const buildRepository = () => ({
    async findByCategoryAndKey() {
      return null;
    },
    async listByCategory() {
      return [];
    },
    async create() {
      throw new Error('create should not be called for malformed financial policy input');
    },
  });

  const createRatePolicy = createCreateRatePolicy({ configRepository: buildRepository() });
  await assert.rejects(
    () => createRatePolicy({
      label: 'Crédito exponencial',
      minAmount: '1e6',
      maxAmount: 2000000,
      annualEffectiveRate: 36,
      priority: 'medium',
    }),
    (error) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.message, 'El monto mínimo debe ser un número válido.');
      return true;
    },
  );

  await assert.rejects(
    () => createRatePolicy({
      label: 'Tasa exponencial',
      minAmount: 0,
      maxAmount: 2000000,
      annualEffectiveRate: '1e2',
      priority: 'medium',
    }),
    (error) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.message, 'La tasa efectiva anual debe estar entre 0 y 100.');
      return true;
    },
  );

  const createLateFeePolicy = createCreateLateFeePolicy({ configRepository: buildRepository() });
  await assert.rejects(
    () => createLateFeePolicy({
      label: 'Mora exponencial',
      annualEffectiveRate: '1e2',
      lateFeeMode: 'SIMPLE',
      priority: 'medium',
    }),
    (error) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.message, 'La tasa efectiva anual debe estar entre 0 y 100.');
      return true;
    },
  );
});

test('config financial policies reject missing labels and invalid ranges with operational messages', async () => {
  const createRatePolicy = createCreateRatePolicy({
    configRepository: {
      async create() {
        throw new Error('create should not be called for invalid rate policy input');
      },
    },
  });

  await assert.rejects(
    () => createRatePolicy({
      label: '',
      minAmount: 0,
      maxAmount: 1000000,
      annualEffectiveRate: 36,
    }),
    (error) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.message, 'El nombre es obligatorio.');
      return true;
    },
  );

  await assert.rejects(
    () => createRatePolicy({
      label: 'Rango invertido',
      minAmount: 2000000,
      maxAmount: 1000000,
      annualEffectiveRate: 36,
    }),
    (error) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.message, 'El monto mínimo no puede ser mayor que el monto máximo.');
      return true;
    },
  );

  const createLateFeePolicy = createCreateLateFeePolicy({
    configRepository: {
      async create() {
        throw new Error('create should not be called for invalid late-fee policy input');
      },
    },
  });

  await assert.rejects(
    () => createLateFeePolicy({ label: '', annualEffectiveRate: 24, lateFeeMode: 'SIMPLE' }),
    (error) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.message, 'El nombre es obligatorio.');
      return true;
    },
  );
});

test('rate policy creation archives the seeded catch-all when the first explicit range is created', async () => {
  let updateCalled = false;
  let createCalled = false;
  let transactionCalled = false;
  let archivedPayload = null;
  const transaction = { id: 'rate-policy-replacement-tx' };
  const seededEntry = {
    id: 11,
    key: 'standard-credit',
    label: 'Crédito estándar',
    isActive: true,
    value: {
      minAmount: 0,
      maxAmount: null,
      annualEffectiveRate: 60,
      priority: 'medium',
      metadata: { seeded: true },
    },
  };

  const createRatePolicy = createCreateRatePolicy({
    configRepository: {
      async runInTransaction(work) {
        transactionCalled = true;
        return work(transaction);
      },
      async findByCategoryAndKey(_category, _key, options = {}) {
        assert.equal(options.transaction, transaction);
        return null;
      },
      async listByCategory(_category, options = {}) {
        assert.equal(options.transaction, transaction);
        return [seededEntry];
      },
      async update(id, payload, options = {}) {
        assert.equal(id, seededEntry.id);
        assert.equal(options.transaction, transaction);
        updateCalled = true;
        archivedPayload = payload;
        return {
          ...seededEntry,
          ...payload,
        };
      },
      async create(payload, options = {}) {
        assert.equal(options.transaction, transaction);
        createCalled = true;
        return { id: 12, ...payload };
      },
    },
  });

  const createdPolicy = await createRatePolicy({
    label: 'Crédito estándar',
    minAmount: 0,
    maxAmount: 1000000,
    annualEffectiveRate: 48,
  });

  assert.equal(createdPolicy.label, 'Crédito estándar');
  assert.equal(createdPolicy.minAmount, 0);
  assert.equal(createdPolicy.maxAmount, 1000000);
  assert.equal(transactionCalled, true);
  assert.equal(updateCalled, true);
  assert.equal(createCalled, true);
  assert.equal(archivedPayload.isActive, false);
  assert.equal(archivedPayload.value.metadata.seeded, true);
  assert.equal(archivedPayload.value.metadata.replacedByExplicitRateRange, true);
});

test('rate policy updates run inside the shared configuration transaction', async () => {
  let transactionCalled = false;
  const transaction = { id: 'rate-policy-update-tx' };
  const existingPolicy = {
    id: 14,
    key: 'credito-estandar',
    label: 'Crédito estándar',
    isActive: true,
    value: {
      minAmount: 0,
      maxAmount: 1000000,
      annualEffectiveRate: 36,
      priority: 'medium',
      description: '',
      metadata: {},
    },
  };

  const updateRatePolicy = createUpdateRatePolicy({
    configRepository: {
      async runInTransaction(work) {
        transactionCalled = true;
        return work(transaction);
      },
      async findByIdAndCategory(id, category, options = {}) {
        assert.equal(id, 14);
        assert.equal(category, 'rate_policy');
        assert.equal(options.transaction, transaction);
        return existingPolicy;
      },
      async findByCategoryAndKey(_category, _key, options = {}) {
        assert.equal(options.transaction, transaction);
        return null;
      },
      async listByCategory(_category, options = {}) {
        assert.equal(options.transaction, transaction);
        return [existingPolicy];
      },
      async update(id, payload, options = {}) {
        assert.equal(id, 14);
        assert.equal(options.transaction, transaction);
        return {
          ...existingPolicy,
          ...payload,
          value: {
            ...existingPolicy.value,
            ...payload.value,
          },
        };
      },
    },
  });

  const updated = await updateRatePolicy(14, {
    annualEffectiveRate: 42,
    description: 'Tasa actualizada',
  });

  assert.equal(transactionCalled, true);
  assert.equal(updated.annualEffectiveRate, 42);
  assert.equal(updated.description, 'Tasa actualizada');
});

test('late-fee policy create and update reuse the shared configuration transaction', async () => {
  const transaction = { id: 'late-fee-policy-tx' };
  let createTransactionCalled = false;
  let updateTransactionCalled = false;
  const existingPolicy = {
    id: 33,
    key: 'mora-simple',
    label: 'Mora simple',
    isActive: true,
    value: {
      annualEffectiveRate: 24,
      lateFeeMode: 'SIMPLE',
      priority: 'medium',
      description: '',
      metadata: {},
    },
  };

  const createLateFeePolicy = createCreateLateFeePolicy({
    configRepository: {
      async runInTransaction(work) {
        createTransactionCalled = true;
        return work(transaction);
      },
      async findByCategoryAndKey(_category, _key, options = {}) {
        assert.equal(options.transaction, transaction);
        return null;
      },
      async listByCategory(_category, options = {}) {
        assert.equal(options.transaction, transaction);
        return [];
      },
      async create(payload, options = {}) {
        assert.equal(options.transaction, transaction);
        return { id: 34, ...payload };
      },
    },
  });

  const created = await createLateFeePolicy({
    label: 'Mora compuesta',
    annualEffectiveRate: 30,
    lateFeeMode: 'COMPOUND',
    priority: 'high',
  });

  const updateLateFeePolicy = createUpdateLateFeePolicy({
    configRepository: {
      async runInTransaction(work) {
        updateTransactionCalled = true;
        return work(transaction);
      },
      async findByIdAndCategory(id, category, options = {}) {
        assert.equal(id, 33);
        assert.equal(category, 'late_fee_policy');
        assert.equal(options.transaction, transaction);
        return existingPolicy;
      },
      async findByCategoryAndKey(_category, _key, options = {}) {
        assert.equal(options.transaction, transaction);
        return null;
      },
      async listByCategory(_category, options = {}) {
        assert.equal(options.transaction, transaction);
        return [existingPolicy];
      },
      async update(id, payload, options = {}) {
        assert.equal(id, 33);
        assert.equal(options.transaction, transaction);
        return {
          ...existingPolicy,
          ...payload,
          value: {
            ...existingPolicy.value,
            ...payload.value,
          },
        };
      },
    },
  });

  const updated = await updateLateFeePolicy(33, {
    annualEffectiveRate: 28,
    description: 'Ajuste operativo',
  });

  assert.equal(createTransactionCalled, true);
  assert.equal(updateTransactionCalled, true);
  assert.equal(created.annualEffectiveRate, 30);
  assert.equal(updated.annualEffectiveRate, 28);
  assert.equal(updated.description, 'Ajuste operativo');
});

test('late-fee policies reject modes that are not configurable from the operational UI', async () => {
  const createLateFeePolicy = createCreateLateFeePolicy({
    configRepository: {
      async findByCategoryAndKey() {
        return null;
      },
      async listByCategory() {
        return [];
      },
      async create() {
        throw new Error('create should not be called');
      },
    },
  });

  await assert.rejects(
    () => createLateFeePolicy({
      label: 'Mora fija incompleta',
      annualEffectiveRate: 12,
      lateFeeMode: 'FLAT',
      priority: 'medium',
    }),
    (error) => error instanceof ValidationError && error.message === 'Selecciona un método de mora válido.',
  );

  await assert.rejects(
    () => createLateFeePolicy({
      label: 'Mora por tramos incompleta',
      annualEffectiveRate: 12,
      lateFeeMode: 'TIERED',
      priority: 'medium',
    }),
    (error) => error instanceof ValidationError && error.message === 'Selecciona un método de mora válido.',
  );
});

test('late-fee policy resolution rejects active policies with the same priority instead of guessing', async () => {
  const resolveLateFeePolicy = createResolveLateFeePolicy({
    configRepository: {
      async listActiveByCategory(category) {
        assert.equal(category, 'late_fee_policy');
        return [
          {
            id: 41,
            key: 'mora-simple-a',
            label: 'Mora simple A',
            isActive: true,
            value: {
              annualEffectiveRate: 24,
              lateFeeMode: 'SIMPLE',
              priority: 'medium',
            },
          },
          {
            id: 42,
            key: 'mora-simple-b',
            label: 'Mora simple B',
            isActive: true,
            value: {
              annualEffectiveRate: 30,
              lateFeeMode: 'SIMPLE',
              priority: 'medium',
            },
          },
        ];
      },
    },
  });

  await assert.rejects(
    () => resolveLateFeePolicy(),
    (error) => error instanceof ConflictError
      && error.message === 'Las políticas de mora activas no pueden compartir la misma prioridad.',
  );
});

test('late-fee policy deletion rejects policies already used by existing loans', async () => {
  const deleteLateFeePolicy = createDeleteLateFeePolicy({
    configRepository: {
      async findByIdAndCategory(id, category) {
        assert.equal(id, 45);
        assert.equal(category, 'late_fee_policy');
        return { id: 45, key: 'mora-usada', label: 'Mora usada' };
      },
      async countLoansUsingLateFeePolicy(id) {
        assert.equal(id, 45);
        return 2;
      },
      async destroy() {
        throw new Error('destroy should not be called for a late-fee policy used by loans');
      },
    },
  });

  await assert.rejects(
    () => deleteLateFeePolicy(45),
    (error) => error instanceof ConflictError
      && error.message === 'No se puede eliminar la política de mora porque ya está asociada a créditos existentes.',
  );
});

test('rate policy deletion rejects policies already used by existing loans', async () => {
  const deleteRatePolicy = createDeleteRatePolicy({
    configRepository: {
      async findByIdAndCategory(id, category) {
        assert.equal(id, 15);
        assert.equal(category, 'rate_policy');
        return { id: 15, key: 'rango-usado', label: 'Rango usado' };
      },
      async countLoansUsingRatePolicy(id) {
        assert.equal(id, 15);
        return 2;
      },
      async destroy() {
        throw new Error('destroy should not be called for used rate policies');
      },
    },
  });

  await assert.rejects(() => deleteRatePolicy(15), (error) => {
    assert.ok(error instanceof ConflictError);
    assert.equal(error.message, 'No se puede eliminar la política de tasa porque ya está asociada a créditos existentes.');
    return true;
  });
});

test('rate policy resolution rejects overlapping active ranges instead of guessing a winner', async () => {
  const resolveRatePolicy = createResolveRatePolicy({
    configRepository: {
      async listActiveByCategory() {
        return [
          {
            id: 11,
            key: 'credito-estandar',
            label: 'Crédito estándar',
            isActive: true,
            value: {
              minAmount: 0,
              maxAmount: null,
              annualEffectiveRate: 36,
              priority: 'medium',
            },
          },
          {
            id: 12,
            key: 'tasa-estandar',
            label: 'Tasa estándar',
            isActive: true,
            value: {
              minAmount: 0,
              maxAmount: 5000000,
              annualEffectiveRate: 60,
              priority: 'high',
            },
          },
        ];
      },
    },
  });

  await assert.rejects(
    () => resolveRatePolicy({ amount: 3000000 }),
    /políticas de tasa activas ambiguas/,
  );
});

test('rate policy listing and resolution tolerate older numeric priorities as stored data', async () => {
  const storedPolicies = [
    {
      id: 11,
      key: 'credito-estandar',
      label: 'Crédito estándar',
      isActive: true,
      value: {
        minAmount: 0,
        maxAmount: null,
        annualEffectiveRate: 36,
        priority: 100,
      },
    },
  ];

  const listRatePolicies = createListRatePolicies({
    configRepository: {
      async listByCategory() {
        return storedPolicies;
      },
    },
  });
  const resolveRatePolicy = createResolveRatePolicy({
    configRepository: {
      async listActiveByCategory() {
        return storedPolicies;
      },
    },
  });

  const policies = await listRatePolicies();
  assert.equal(policies[0].priority, 'high');

  const policy = await resolveRatePolicy({ amount: 2000000 });
  assert.equal(policy.label, 'Crédito estándar');
  assert.equal(policy.priority, 'high');
});

test('rate policy resolution returns null for uncovered amount gaps', async () => {
  const resolveRatePolicy = createResolveRatePolicy({
    configRepository: {
      async listActiveByCategory() {
        return [
          {
            id: 11,
            key: 'credito-pequeno',
            label: 'Crédito pequeño',
            isActive: true,
            value: {
              minAmount: 0,
              maxAmount: 1000000,
              annualEffectiveRate: 36,
              priority: 'medium',
            },
          },
          {
            id: 12,
            key: 'credito-alto',
            label: 'Crédito alto',
            isActive: true,
            value: {
              minAmount: 5000001,
              maxAmount: null,
              annualEffectiveRate: 48,
              priority: 'medium',
            },
          },
        ];
      },
    },
  });

  const policy = await resolveRatePolicy({ amount: 3000000 });
  assert.equal(policy, null);
});

test('createUpsertSetting updates existing records and listAdminCatalogs keeps role scope unchanged', async () => {
  let updatedPayload;

  const upsertSetting = createUpsertSetting({
    configRepository: {
      async findByCategoryAndKey() {
        return {
          id: 9,
          category: 'business_setting',
          key: 'company-name',
          label: 'Nombre de la compania',
          value: { value: 'Anterior', description: 'Anterior descripcion' },
          updatedAt: '2026-03-21T00:00:00.000Z',
        };
      },
      async update(id, payload) {
        updatedPayload = { id, payload };
        return {
          id,
          category: 'business_setting',
          key: 'company-name',
          ...payload,
          updatedAt: '2026-03-22T00:00:00.000Z',
        };
      },
      async create() {
        throw new Error('create should not be called for an existing setting');
      },
    },
  });

  const setting = await upsertSetting('company-name', {
    label: 'Nombre legal',
    value: 'LendFlow SAS',
    description: 'Visible en exportes',
  });

  assert.deepEqual(updatedPayload, {
    id: 9,
    payload: {
      label: 'Nombre legal',
      value: {
        value: 'LendFlow SAS',
        description: 'Visible en exportes',
      },
      isActive: true,
    },
  });
  assert.deepEqual(setting, {
    id: 9,
    key: 'company-name',
    label: 'Nombre legal',
    value: 'LendFlow SAS',
    description: 'Visible en exportes',
    updatedAt: '2026-03-22T00:00:00.000Z',
  });

  const catalogs = await createListAdminCatalogs()();
  assert.deepEqual(catalogs.roles, ['admin', 'employee']);
  assert.deepEqual(catalogs.paymentVisibilities, ['customer', 'internal']);
});

test('createUpsertSetting preserves existing setting label and description when only value changes', async () => {
  let updatedPayload;

  const upsertSetting = createUpsertSetting({
    configRepository: {
      async findByCategoryAndKey() {
        return {
          id: 10,
          category: 'business_setting',
          key: 'support-email',
          label: 'Correo de soporte',
          value: { value: 'soporte@anterior.test', description: 'Visible para comunicaciones operativas' },
          updatedAt: '2026-03-21T00:00:00.000Z',
        };
      },
      async update(id, payload) {
        updatedPayload = { id, payload };
        return {
          id,
          category: 'business_setting',
          key: 'support-email',
          ...payload,
          updatedAt: '2026-03-22T00:00:00.000Z',
        };
      },
      async create() {
        throw new Error('create should not be called for an existing setting');
      },
    },
  });

  const setting = await upsertSetting('support-email', {
    value: 'soporte@nuevo.test',
  });

  assert.deepEqual(updatedPayload, {
    id: 10,
    payload: {
      label: 'Correo de soporte',
      value: {
        value: 'soporte@nuevo.test',
        description: 'Visible para comunicaciones operativas',
      },
      isActive: true,
    },
  });
  assert.deepEqual(setting, {
    id: 10,
    key: 'support-email',
    label: 'Correo de soporte',
    value: 'soporte@nuevo.test',
    description: 'Visible para comunicaciones operativas',
    updatedAt: '2026-03-22T00:00:00.000Z',
  });
});

test('createUpsertSetting keeps base currency read-only in this phase', async () => {
  const upsertSetting = createUpsertSetting({
    configRepository: {
      async findByCategoryAndKey() {
        throw new Error('base currency should be rejected before repository access');
      },
      async update() {
        throw new Error('update should not be called for base currency');
      },
      async create() {
        throw new Error('create should not be called for base currency');
      },
    },
  });

  await assert.rejects(
    () => upsertSetting('base-currency', { value: 'USD' }),
    (error) => error instanceof ValidationError
      && error.message === 'La moneda base es fija en COP en esta versión.',
  );
});

test('createConfigModule consumes shared auth context and registers the config surface', () => {
  let authMiddlewareRoles;

  const moduleRegistration = createConfigModule({
    sharedRuntime: {
      authContext: {
        tokenService: { sign() {}, verify() {} },
        authMiddleware(roles) {
          authMiddlewareRoles = roles;
          return (_req, _res, next) => next();
        },
      },
    },
  });

  assert.equal(moduleRegistration.name, 'config');
  assert.equal(moduleRegistration.basePath, '/api/config');
  assert.deepEqual(authMiddlewareRoles, ['admin']);
});

test('createListRoles returns only administrative login roles', async () => {
  const listRoles = createListRoles();
  const roles = await listRoles();

  assert.ok(Array.isArray(roles));
  assert.deepEqual(roles.map((role) => role.id), ['admin', 'employee']);

  const adminRole = roles.find((role) => role.id === 'admin');
  assert.equal(adminRole.name, 'Administrador');
  assert.ok(adminRole.description.includes('Acceso completo'));

  const employeeRole = roles.find((role) => role.id === 'employee');
  assert.equal(employeeRole.name, 'Empleado');
  assert.ok(employeeRole.description.includes('módulos autorizados'));

  assert.equal(roles.some((role) => ['CUSTOMER', 'PARTNER', 'customer', 'socio'].includes(role.id)), false);
});
