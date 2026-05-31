const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  createCheckMultiplePermissions,
  createGetPermissionsByModule,
  createGetMyPermissions,
  createGetUserPermissions,
  createGrantBatchPermissions,
  createGrantPermission,
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
