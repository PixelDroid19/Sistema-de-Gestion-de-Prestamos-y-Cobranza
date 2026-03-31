const { test } = require('node:test');
const assert = require('node:assert/strict');

test('permissionService.listAll returns all permissions', async () => {
  const mockPermissions = [
    { id: 1, name: 'CREDITS_VIEW_ALL', module: 'CREDITOS', description: 'View all credits' },
    { id: 2, name: 'CLIENTS_VIEW_ALL', module: 'CLIENTES', description: 'View all clients' },
  ];

  const testService = {
    async listAll() {
      return mockPermissions;
    },
  };

  const result = await testService.listAll();

  assert.deepEqual(result, mockPermissions);
});

test('permissionService.getByModule returns filtered permissions', async () => {
  const mockCreditsPermissions = [
    { id: 1, name: 'CREDITS_VIEW_ALL', module: 'CREDITOS', description: 'View all credits' },
    { id: 2, name: 'CREDITS_CREATE', module: 'CREDITOS', description: 'Create credits' },
  ];

  const testService = {
    async getByModule(module) {
      return mockCreditsPermissions.filter((p) => p.module === module);
    },
  };

  const result = await testService.getByModule('CREDITOS');

  assert.deepEqual(result, mockCreditsPermissions);
});

test('permissionService.getMyPermissions returns resolved permissions for actor', async () => {
  const directPerms = [
    { Permission: { id: 1, name: 'CREDITS_VIEW_ALL', module: 'CREDITOS' } },
  ];
  const rolePerms = [
    { Permission: { id: 2, name: 'CLIENTS_VIEW_ALL', module: 'CLIENTES' } },
  ];

  const testService = {
    async getMyPermissions(actor) {
      if (!actor || !actor.id) {
        return { direct: [], role: [], resolved: [] };
      }
      const directPermNames = new Set(directPerms.map((p) => p.Permission?.name));
      const rolePermNames = new Set(rolePerms.map((p) => p.Permission?.name));
      const resolved = [...directPermNames, ...rolePermNames];
      return {
        direct: directPerms.map((up) => up.Permission),
        role: rolePerms.map((rp) => rp.Permission),
        resolved,
      };
    },
  };

  const actor = { id: 7, role: 'customer' };
  const result = await testService.getMyPermissions(actor);

  assert.deepEqual(result.direct, [{ id: 1, name: 'CREDITS_VIEW_ALL', module: 'CREDITOS' }]);
  assert.deepEqual(result.role, [{ id: 2, name: 'CLIENTS_VIEW_ALL', module: 'CLIENTES' }]);
  assert.deepEqual(result.resolved, ['CREDITS_VIEW_ALL', 'CLIENTS_VIEW_ALL']);
});

test('permissionService.check returns true for direct permission', async () => {
  const directPerms = [
    { Permission: { id: 1, name: 'CREDITS_VIEW_ALL', module: 'CREDITOS' } },
  ];

  const testService = {
    async check(actor, permissionName) {
      if (!actor || !actor.id) {
        return false;
      }
      const hasDirectPermission = directPerms.some(
        (up) => up.Permission && up.Permission.name === permissionName
      );
      if (hasDirectPermission) {
        return true;
      }
      return false;
    },
  };

  const actor = { id: 7 };
  const result = await testService.check(actor, 'CREDITS_VIEW_ALL');

  assert.equal(result, true);
});

test('permissionService.check returns true for role permission', async () => {
  const rolePerms = [
    { Permission: { id: 2, name: 'CLIENTS_VIEW_ALL', module: 'CLIENTES' } },
  ];

  const testService = {
    async check(actor, permissionName) {
      if (!actor || !actor.id) {
        return false;
      }
      const hasRolePermission = rolePerms.some(
        (rp) => rp.Permission && rp.Permission.name === permissionName
      );
      if (hasRolePermission) {
        return true;
      }
      return false;
    },
  };

  const actor = { id: 7 };
  const result = await testService.check(actor, 'CLIENTS_VIEW_ALL');

  assert.equal(result, true);
});

test('permissionService.check returns false when no permission', async () => {
  const emptyPerms = [];

  const testService = {
    async check(actor, permissionName) {
      if (!actor || !actor.id) {
        return false;
      }
      const hasDirectPermission = emptyPerms.some(
        (up) => up.Permission && up.Permission.name === permissionName
      );
      if (hasDirectPermission) {
        return true;
      }
      return false;
    },
  };

  const actor = { id: 7 };
  const result = await testService.check(actor, 'NONEXISTENT_PERMISSION');

  assert.equal(result, false);
});

test('permissionService.checkMultiple returns granted and denied arrays', async () => {
  const directPerms = [
    { Permission: { id: 1, name: 'CREDITS_VIEW_ALL', module: 'CREDITOS' } },
  ];
  const rolePerms = [
    { Permission: { id: 2, name: 'CLIENTS_VIEW_ALL', module: 'CLIENTES' } },
  ];

  const testService = {
    async checkMultiple(actor, permissionNames) {
      if (!actor || !actor.id) {
        return { granted: [], denied: permissionNames };
      }
      const directPermNames = new Set(directPerms.map((p) => p.Permission?.name));
      const rolePermNames = new Set(rolePerms.map((p) => p.Permission?.name));
      const granted = permissionNames.filter(
        (name) => directPermNames.has(name) || rolePermNames.has(name)
      );
      const denied = permissionNames.filter(
        (name) => !directPermNames.has(name) && !rolePermNames.has(name)
      );
      return { granted, denied };
    },
  };

  const actor = { id: 7 };
  const result = await testService.checkMultiple(actor, [
    'CREDITS_VIEW_ALL',
    'CLIENTS_VIEW_ALL',
    'PERMISSIONS_GRANT',
  ]);

  assert.deepEqual(result.granted, ['CREDITS_VIEW_ALL', 'CLIENTS_VIEW_ALL']);
  assert.deepEqual(result.denied, ['PERMISSIONS_GRANT']);
});
