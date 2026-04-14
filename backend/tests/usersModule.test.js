const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createListUsers,
  createGetUserById,
  createUpdateUser,
  createDeactivateUser,
  createReactivateUser,
  createUnlockUser,
} = require('../src/modules/users/application/useCases');
const { ConflictError, NotFoundError } = require('../src/utils/errorHandler');

test('createListUsers sanitizes administrative user listings', async () => {
  const listUsers = createListUsers({
    userRepository: {
      async findAll() {
        return [
          { id: 1, name: 'Admin', email: 'admin@example.com', role: 'admin', password: 'hidden', isActive: true },
        ];
      },
    },
  });

  const users = await listUsers();

  assert.deepEqual(users, [
    {
      id: 1,
      name: 'Admin',
      email: 'admin@example.com',
      role: 'admin',
      associateId: null,
      isActive: true,
      createdAt: undefined,
      updatedAt: undefined,
    },
  ]);
});

test('createListUsers preserves pagination metadata while sanitizing items', async () => {
  const listUsers = createListUsers({
    userRepository: {
      async findPage() {
        return {
          items: [{ id: 1, name: 'Admin', email: 'admin@example.com', role: 'admin', password: 'hidden', isActive: true }],
          pagination: { page: 2, pageSize: 10, totalItems: 11, totalPages: 2 },
        };
      },
    },
  });

  const result = await listUsers({ pagination: { page: 2, pageSize: 10 } });

  assert.deepEqual(result, {
    items: [{
      id: 1,
      name: 'Admin',
      email: 'admin@example.com',
      role: 'admin',
      associateId: null,
      isActive: true,
      createdAt: undefined,
      updatedAt: undefined,
    }],
    pagination: { page: 2, pageSize: 10, totalItems: 11, totalPages: 2 },
  });
});

test('createUpdateUser rejects duplicate email changes', async () => {
  const updateUser = createUpdateUser({
    userRepository: {
      async findById() {
        return { id: 5, name: 'User', email: 'user@example.com', role: 'customer', isActive: true };
      },
      async findByEmail() {
        return { id: 9, email: 'taken@example.com' };
      },
      async update() {
        throw new Error('update should not be called');
      },
    },
  });

  await assert.rejects(() => updateUser(5, { email: 'taken@example.com' }), ConflictError);
});

test('createDeactivateUser and createReactivateUser persist user activation toggles', async () => {
  const updates = [];
  const userRepository = {
    async findById(id) {
      return { id, name: 'User', email: 'user@example.com', role: 'customer', isActive: true };
    },
    async update(id, payload) {
      updates.push({ id, payload });
      return { id, name: 'User', email: 'user@example.com', role: 'customer', ...payload };
    },
  };

  const deactivateUser = createDeactivateUser({ userRepository });
  const reactivateUser = createReactivateUser({ userRepository });

  const deactivated = await deactivateUser(8);
  const reactivated = await reactivateUser(8);

  assert.equal(deactivated.isActive, false);
  assert.equal(reactivated.isActive, true);
  assert.deepEqual(updates, [
    { id: 8, payload: { isActive: false } },
    { id: 8, payload: { isActive: true } },
  ]);
});

test('createGetUserById throws NotFoundError for missing users', async () => {
  const getUserById = createGetUserById({
    userRepository: {
      async findById() {
        return null;
      },
    },
  });

  await assert.rejects(() => getUserById(404), NotFoundError);
});

test('createUnlockUser resets lock counters for locked accounts', async () => {
  const updates = [];
  const userRepository = {
    async findById(id) {
      return {
        id,
        name: 'Locked User',
        email: 'locked@example.com',
        role: 'customer',
        failedLoginAttempts: 5,
        lockedUntil: '2026-04-10T00:00:00.000Z',
      };
    },
    async update(id, payload) {
      updates.push({ id, payload });
      return {
        id,
        name: 'Locked User',
        email: 'locked@example.com',
        role: 'customer',
        ...payload,
      };
    },
  };

  const unlockUser = createUnlockUser({ userRepository });
  const unlocked = await unlockUser(12);

  assert.equal(unlocked.id, 12);
  assert.deepEqual(updates, [{ id: 12, payload: { failedLoginAttempts: 0, lockedUntil: null } }]);
});
