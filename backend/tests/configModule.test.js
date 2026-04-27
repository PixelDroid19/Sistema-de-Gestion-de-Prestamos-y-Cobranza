const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createCreatePaymentMethod,
  createUpdatePaymentMethod,
  createDeletePaymentMethod,
  createUpsertSetting,
  createListAdminCatalogs,
  createListRoles,
} = require('@/modules/config/application/useCases');
const { createConfigModule } = require('@/modules/config');
const { ConflictError, NotFoundError } = require('@/utils/errorHandler');

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
  assert.deepEqual(catalogs.roles, ['admin', 'customer', 'socio']);
  assert.deepEqual(catalogs.paymentVisibilities, ['customer', 'internal']);
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

test('createListRoles returns the catalog of available roles', async () => {
  const listRoles = createListRoles();
  const roles = await listRoles();

  assert.ok(Array.isArray(roles));
  assert.ok(roles.length > 0);
  
  // Verify role structure
  const customerRole = roles.find(r => r.id === 'CUSTOMER');
  assert.ok(customerRole);
  assert.equal(customerRole.name, 'Cliente');
  assert.ok(Array.isArray(customerRole.defaultPermissions));
  
  const partnerRole = roles.find(r => r.id === 'PARTNER');
  assert.ok(partnerRole);
  assert.ok(partnerRole.defaultPermissions.includes('READ_CREDITOS'));
});
