const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  createGetMyPermissions,
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
    /Permissions can only be assigned to employee accounts/,
  );
});
