const test = require('node:test');
const assert = require('node:assert/strict');

const models = require('@/models');

test('RolePermission reports missing composite keys in Spanish', async () => {
  const rolePermission = models.RolePermission.build({ role: 'admin' });

  await assert.rejects(
    () => rolePermission.validate(),
    (error) => {
      assert.match(error.message, /La relación entre rol y permiso debe incluir ambos datos/);
      assert.doesNotMatch(error.message, /cannot be null|Composite primary key|permissionId/);
      return true;
    },
  );
});
