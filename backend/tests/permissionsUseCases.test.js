const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  createCheckMultiplePermissions,
  createGetPermissionsByModule,
  createGetMyPermissions,
  createGetUserPermissions,
  createGrantBatchPermissions,
  createGrantPermission,
  createSetAllDirectPermissions,
} = require('@/modules/permissions/application/useCases');

const createPermissionRepositories = ({ user }) => ({
  userRepository: {
    async findById(id) {
      return Number(id) === Number(user?.id) ? user : null;
    },
  },
  userPermissionRepository: {
    async findByUser() {
      return [];
    },
    async grant() {
      return { id: 1, userId: user.id, permissionId: 7, grantedBy: 1 };
    },
  },
  rolePermissionRepository: {
    async findByRole(role) {
      if (role !== 'admin') return [];
      return [
        {
          Permission: {
            id: 7,
            name: 'PERMISSIONS_VIEW_ALL',
            module: 'PERMISOS',
            description: 'View permissions',
          },
        },
      ];
    },
  },
  permissionRepository: {
    async findByName(name) {
      return {
        id: 7,
        name,
        module: 'PERMISOS',
        description: 'View permissions',
      };
    },
  },
});

test('createGetMyPermissions returns admin role permissions without treating admin as assignable employee target', async () => {
  const user = { id: 1, role: 'admin' };
  const repositories = createPermissionRepositories({ user });
  const getMyPermissions = createGetMyPermissions(repositories);

  const result = await getMyPermissions({ actor: user });

  assert.equal(result.userId, 1);
  assert.equal(result.role, 'admin');
  assert.deepEqual(result.permissionNames, ['PERMISSIONS_VIEW_ALL']);
  assert.equal(result.permissions[0].name, 'PERMISSIONS_VIEW_ALL');
});

test('createGrantPermission still rejects assigning permissions to non-employee accounts', async () => {
  const user = { id: 1, role: 'admin' };
  const repositories = createPermissionRepositories({ user });
  const grantPermission = createGrantPermission(repositories);

  await assert.rejects(
    () => grantPermission({
      actor: { id: 99, role: 'admin' },
      targetUserId: 1,
      permission: 'PERMISSIONS_VIEW_ALL',
    }),
    /Los permisos solo pueden asignarse a cuentas de empleados/,
  );
});

test('createGetPermissionsByModule rejects invalid modules without exposing the module catalog', async () => {
  const permissionRepository = {
    async findByModule() {
      throw new Error('should not query invalid modules');
    },
  };
  const getPermissionsByModule = createGetPermissionsByModule({ permissionRepository });

  await assert.rejects(
    () => getPermissionsByModule({ module: 'RISK_ENGINE' }),
    (error) => {
      assert.equal(error.name, 'ValidationError');
      assert.equal(error.message, 'Filtro de permisos inválido.');
      assert.doesNotMatch(error.message, /RISK_ENGINE|CREDITOS|CLIENTES|PERMISOS/);
      return true;
    },
  );
});

test('permission use cases reject missing operator context with an operational message', async () => {
  const user = { id: 1, role: 'employee' };
  const repositories = createPermissionRepositories({ user });
  const getMyPermissions = createGetMyPermissions(repositories);

  await assert.rejects(
    () => getMyPermissions({ actor: null }),
    (error) => {
      assert.equal(error.name, 'ValidationError');
      assert.equal(error.message, 'No se pudo identificar la sesión del operador.');
      assert.doesNotMatch(error.message, /actor|userId|targetUserId/i);
      return true;
    },
  );
});

test('permission use cases reject missing target users without exposing payload field names', async () => {
  const user = { id: 1, role: 'employee' };
  const repositories = createPermissionRepositories({ user });
  const getUserPermissions = createGetUserPermissions(repositories);

  await assert.rejects(
    () => getUserPermissions({ actor: { id: 99, role: 'admin' }, targetUserId: '' }),
    (error) => {
      assert.equal(error.name, 'ValidationError');
      assert.equal(error.message, 'El usuario es obligatorio.');
      assert.doesNotMatch(error.message, /targetUserId|userId/i);
      return true;
    },
  );
});

test('permission grants reject malformed permission references with operational messages', async () => {
  const user = { id: 1, role: 'employee' };
  const repositories = createPermissionRepositories({ user });
  const grantPermission = createGrantPermission(repositories);

  await assert.rejects(
    () => grantPermission({
      actor: { id: 99, role: 'admin' },
      targetUserId: 1,
      permissionId: '1e2',
    }),
    (error) => {
      assert.equal(error.name, 'ValidationError');
      assert.equal(error.message, 'El permiso debe ser un entero positivo.');
      assert.doesNotMatch(error.message, /permissionId/i);
      return true;
    },
  );

  await assert.rejects(
    () => grantPermission({
      actor: { id: 99, role: 'admin' },
      targetUserId: 1,
      permission: '',
    }),
    (error) => {
      assert.equal(error.name, 'ValidationError');
      assert.equal(error.message, 'El permiso es obligatorio.');
      assert.doesNotMatch(error.message, /permission/i);
      return true;
    },
  );
});

test('batch permission checks reject malformed lists without implementation field names', async () => {
  const user = { id: 1, role: 'employee' };
  const repositories = createPermissionRepositories({ user });
  const grantBatchPermissions = createGrantBatchPermissions(repositories);
  const checkMultiplePermissions = createCheckMultiplePermissions(repositories);

  await assert.rejects(
    () => grantBatchPermissions({
      actor: { id: 99, role: 'admin' },
      targetUserId: 1,
      permissions: [],
    }),
    (error) => {
      assert.equal(error.name, 'ValidationError');
      assert.equal(error.message, 'Debes seleccionar al menos un permiso.');
      assert.doesNotMatch(error.message, /permissionIds|permissions/i);
      return true;
    },
  );

  await assert.rejects(
    () => checkMultiplePermissions({ actor: user, permissions: [7] }),
    (error) => {
      assert.equal(error.name, 'ValidationError');
      assert.equal(error.message, 'Cada permiso debe indicarse con un nombre válido.');
      assert.doesNotMatch(error.message, /permissionName|permissionNames/i);
      return true;
    },
  );
});

test('set-all grants only missing direct permissions and preserves existing assignments', async () => {
  const user = { id: 12, role: 'employee' };
  const catalog = [
    { id: 1, name: 'CREDITS_VIEW_ALL' },
    { id: 2, name: 'CLIENTS_VIEW_ALL' },
  ];
  const assignments = [{ permissionId: 1, Permission: catalog[0] }];
  const grants = [];
  const events = [];
  const useCase = createSetAllDirectPermissions({
    userRepository: { findById: async () => user },
    permissionRepository: { findAll: async () => catalog },
    userPermissionRepository: {
      runInTransaction: (work) => work({ transaction: { id: 'permission-tx' } }),
      findByUser: async () => assignments,
      grantMany: async (payload, options) => {
        grants.push({ payload, options });
        return payload.permissionIds.length;
      },
    },
    eventBus: { emit: (...args) => events.push(args) },
  });

  const result = await useCase({ actor: { id: 3, role: 'admin' }, targetUserId: 12, action: 'grant_all' });

  assert.deepEqual(result, { userId: 12, action: 'grant_all', changedCount: 1, directCount: 2 });
  assert.deepEqual(grants[0].payload.permissionIds, [2]);
  assert.equal(grants[0].options.transaction.id, 'permission-tx');
  assert.equal(events.length, 1);
  assert.deepEqual(events[0][1].permissionNames, ['CLIENTS_VIEW_ALL']);
});

test('set-all revokes direct permissions without mutating inherited permissions', async () => {
  const events = [];
  const assignments = [{ permissionId: 1, Permission: { name: 'CREDITS_VIEW_ALL' } }];
  const useCase = createSetAllDirectPermissions({
    userRepository: { findById: async () => ({ id: 12, role: 'employee' }) },
    permissionRepository: { findAll: async () => { throw new Error('revoke must not read or change the catalog'); } },
    userPermissionRepository: {
      runInTransaction: (work) => work({ transaction: { id: 'permission-tx' } }),
      findByUser: async () => assignments,
      revokeAllForUser: async (_userId, options) => {
        assert.equal(options.transaction.id, 'permission-tx');
        return assignments.length;
      },
    },
    eventBus: { emit: (...args) => events.push(args) },
  });

  const result = await useCase({ actor: { id: 3, role: 'admin' }, targetUserId: 12, action: 'revoke_all' });

  assert.deepEqual(result, { userId: 12, action: 'revoke_all', changedCount: 1, directCount: 0 });
  assert.deepEqual(events[0][1].permissionNames, ['CREDITS_VIEW_ALL']);
});

test('set-all rejects invalid action and non-employee targets before changing assignments', async () => {
  let writes = 0;
  const useCase = createSetAllDirectPermissions({
    userRepository: { findById: async () => ({ id: 12, role: 'admin' }) },
    permissionRepository: { findAll: async () => [{ id: 1, name: 'CREDITS_VIEW_ALL' }] },
    userPermissionRepository: {
      runInTransaction: (work) => work({ transaction: {} }),
      findByUser: async () => [],
      grantMany: async () => { writes += 1; return 1; },
      revokeAllForUser: async () => { writes += 1; return 0; },
    },
    eventBus: { emit: () => {} },
  });

  await assert.rejects(() => useCase({ actor: { id: 3, role: 'admin' }, targetUserId: 12, action: 'invalid' }), /acción sobre todos los permisos no es válida/);
  await assert.rejects(() => useCase({ actor: { id: 3, role: 'admin' }, targetUserId: 12, action: 'grant_all' }), /solo pueden asignarse a cuentas de empleados/);
  await assert.rejects(() => useCase({ actor: { id: 12, role: 'employee' }, targetUserId: 12, action: 'revoke_all' }), /Solo un administrador/);
  assert.equal(writes, 0);
});
