const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createCreatePaymentMethod,
  createUpdatePaymentMethod,
  createDeletePaymentMethod,
  createListRatePolicies,
  createCreateRatePolicy,
  createDeleteRatePolicy,
  createResolveRatePolicy,
  createCreateLateFeePolicy,
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

  await assert.rejects(() => createPaymentMethod({ label: 'Cash', key: 'cash' }), ConflictError);

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
    ConflictError,
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
    ConflictError,
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
    ConflictError,
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
    (error) => error instanceof ValidationError && /minAmount/.test(error.message),
  );

  await assert.rejects(
    () => createRatePolicy({
      label: 'Tasa exponencial',
      minAmount: 0,
      maxAmount: 2000000,
      annualEffectiveRate: '1e2',
      priority: 'medium',
    }),
    (error) => error instanceof ValidationError && /annualEffectiveRate/.test(error.message),
  );

  const createLateFeePolicy = createCreateLateFeePolicy({ configRepository: buildRepository() });
  await assert.rejects(
    () => createLateFeePolicy({
      label: 'Mora exponencial',
      annualEffectiveRate: '1e2',
      lateFeeMode: 'SIMPLE',
      priority: 'medium',
    }),
    (error) => error instanceof ValidationError && /annualEffectiveRate/.test(error.message),
  );
});

test('rate policy creation replaces the seeded catch-all when the first explicit range is created', async () => {
  let updatedSeed;
  let createdPayload;
  const seededEntry = {
    id: 11,
    key: 'credito-estandar',
    label: 'Crédito estándar',
    isActive: true,
    value: {
      minAmount: 0,
      maxAmount: null,
      annualEffectiveRate: 36,
      priority: 'medium',
      metadata: { seeded: true },
    },
  };

  const createRatePolicy = createCreateRatePolicy({
    configRepository: {
      async findByCategoryAndKey(category, key) {
        return key === 'credito-estandar' ? seededEntry : null;
      },
      async listByCategory() {
        return [seededEntry];
      },
      async update(id, payload) {
        updatedSeed = { id, ...payload };
        return updatedSeed;
      },
      async create(payload) {
        createdPayload = payload;
        return {
          id: 12,
          ...payload,
          createdAt: '2026-05-20T00:00:00.000Z',
          updatedAt: '2026-05-20T00:00:00.000Z',
        };
      },
    },
  });

  const result = await createRatePolicy({
    label: 'Crédito estándar',
    minAmount: 0,
    maxAmount: 1000000,
    annualEffectiveRate: 48,
  });

  assert.equal(updatedSeed.id, 11);
  assert.equal(updatedSeed.isActive, false);
  assert.equal(updatedSeed.key, 'credito-estandar');
  assert.equal(updatedSeed.value.metadata.replacedByExplicitRateRange, true);
  assert.equal(createdPayload.key, 'credito-estandar');
  assert.equal(createdPayload.value.minAmount, 0);
  assert.equal(createdPayload.value.maxAmount, 1000000);
  assert.equal(createdPayload.value.annualEffectiveRate, 48);
  assert.equal(createdPayload.value.priority, 'medium');
  assert.equal(result.label, 'Crédito estándar');
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
    /lateFeeMode is invalid/,
  );

  await assert.rejects(
    () => createLateFeePolicy({
      label: 'Mora por tramos incompleta',
      annualEffectiveRate: 12,
      lateFeeMode: 'TIERED',
      priority: 'medium',
    }),
    /lateFeeMode is invalid/,
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
    assert.match(error.message, /used by existing loans/i);
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
