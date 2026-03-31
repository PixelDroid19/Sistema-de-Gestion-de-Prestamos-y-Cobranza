const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { AccountLockedError } = require('../src/utils/errorHandler');

test('AccountLockedError has correct status code 423', () => {
  const error = new AccountLockedError();
  assert.equal(error.statusCode, 423);
  assert.equal(error.name, 'AccountLockedError');
});

test('AccountLockedError has default message', () => {
  const error = new AccountLockedError();
  assert.ok(error.message.includes('temporarily locked'));
});

test('AccountLockedError has custom message', () => {
  const error = new AccountLockedError('Custom lockout message');
  assert.equal(error.message, 'Custom lockout message');
});

test('AccountLockedError has lockoutDurationMinutes', () => {
  const error = new AccountLockedError('Test', 30);
  assert.equal(error.lockoutDurationMinutes, 30);
});

test('AccountLockedError defaults lockoutDurationMinutes to 15', () => {
  const error = new AccountLockedError();
  assert.equal(error.lockoutDurationMinutes, 15);
});

describe('createLoginUser with progressive delays and lockout', () => {
  const { createLoginUser } = require('../src/modules/auth/application/useCases');

  test('rejects login for non-existent user with generic error', async () => {
    const loginUser = createLoginUser({
      userRepository: {
        async findByEmail() { return null; },
      },
      passwordHasher: {
        async compare() { return true; },
      },
      tokenService: {
        sign() { return 'token'; },
      },
    });

    await assert.rejects(
      async () => loginUser({ email: 'nonexistent@test.com', password: 'any' }),
      (error) => {
        assert.equal(error.message, 'Please enter correct email/password');
        return true;
      }
    );
  });

  test('successful login resets failed attempts', async () => {
    let updatedFields = null;
    const loginUser = createLoginUser({
      userRepository: {
        async findByEmail() {
          return {
            id: 1,
            email: 'test@test.com',
            password: 'hashed',
            role: 'customer',
            failedLoginAttempts: 3,
            lockedUntil: null,
          };
        },
        async update(userId, fields) {
          updatedFields = fields;
          return { id: userId, ...fields };
        },
      },
      passwordHasher: {
        async compare() { return true; },
      },
      tokenService: {
        sign() { return 'token'; },
      },
    });

    const result = await loginUser({ email: 'test@test.com', password: 'correct' });

    assert.equal(result.user.id, 1);
    assert.equal(updatedFields.failedLoginAttempts, 0);
    assert.equal(updatedFields.lockedUntil, null);
  });

  test('failed login increments failedLoginAttempts', async () => {
    let updatedFields = null;
    const loginUser = createLoginUser({
      userRepository: {
        async findByEmail() {
          return {
            id: 1,
            email: 'test@test.com',
            password: 'hashed',
            role: 'customer',
            failedLoginAttempts: 0,
            lockedUntil: null,
          };
        },
        async update(userId, fields) {
          updatedFields = fields;
          return { id: userId, ...fields };
        },
      },
      passwordHasher: {
        async compare() { return false; },
      },
      tokenService: {
        sign() { return 'token'; },
      },
    });

    await assert.rejects(
      async () => loginUser({ email: 'test@test.com', password: 'wrong' }),
      /Please enter correct email\/password/
    );

    assert.equal(updatedFields.failedLoginAttempts, 1);
  });

  test('locks account after 5 consecutive failed attempts', async () => {
    let updatedFields = null;
    const loginUser = createLoginUser({
      userRepository: {
        async findByEmail() {
          return {
            id: 1,
            email: 'test@test.com',
            password: 'hashed',
            role: 'customer',
            failedLoginAttempts: 4,
            lockedUntil: null,
          };
        },
        async update(userId, fields) {
          updatedFields = fields;
          return { id: userId, ...fields };
        },
      },
      passwordHasher: {
        async compare() { return false; },
      },
      tokenService: {
        sign() { return 'token'; },
      },
    });

    await assert.rejects(
      async () => loginUser({ email: 'test@test.com', password: 'wrong' }),
      /Please enter correct email\/password/
    );

    assert.equal(updatedFields.failedLoginAttempts, 5);
    assert.ok(updatedFields.lockedUntil instanceof Date);
    assert.ok(new Date(updatedFields.lockedUntil) > new Date());
  });

  test('rejects login for locked account', async () => {
    const futureLockout = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes in future
    const loginUser = createLoginUser({
      userRepository: {
        async findByEmail() {
          return {
            id: 1,
            email: 'test@test.com',
            password: 'hashed',
            role: 'customer',
            failedLoginAttempts: 5,
            lockedUntil: futureLockout,
          };
        },
        async update() {
          return {};
        },
      },
      passwordHasher: {
        async compare() { return true; },
      },
      tokenService: {
        sign() { return 'token'; },
      },
    });

    await assert.rejects(
      async () => loginUser({ email: 'test@test.com', password: 'correct' }),
      (error) => {
        assert.equal(error.name, 'AccountLockedError');
        assert.equal(error.statusCode, 423);
        return true;
      }
    );
  });

  test('allows login after lockout expires', async () => {
    const pastLockout = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago
    let updatedFields = null;
    const loginUser = createLoginUser({
      userRepository: {
        async findByEmail() {
          return {
            id: 1,
            email: 'test@test.com',
            password: 'hashed',
            role: 'customer',
            failedLoginAttempts: 5,
            lockedUntil: pastLockout,
          };
        },
        async update(userId, fields) {
          updatedFields = fields;
          return { id: userId, ...fields };
        },
      },
      passwordHasher: {
        async compare() { return true; },
      },
      tokenService: {
        sign() { return 'token'; },
      },
    });

    const result = await loginUser({ email: 'test@test.com', password: 'correct' });
    assert.equal(result.user.id, 1);
    assert.equal(updatedFields.failedLoginAttempts, 0);
    assert.equal(updatedFields.lockedUntil, null);
  });
});

describe('createUnlockUser', () => {
  const { createUnlockUser } = require('../src/modules/users/application/useCases');

  test('unlockUser resets failedLoginAttempts and lockedUntil', async () => {
    let updatedFields = null;
    const unlockUser = createUnlockUser({
      userRepository: {
        async findById(userId) {
          return {
            id: userId,
            email: 'test@test.com',
            failedLoginAttempts: 5,
            lockedUntil: new Date(),
          };
        },
        async update(userId, fields) {
          updatedFields = fields;
          return { id: userId, failedLoginAttempts: 0, lockedUntil: null, ...fields };
        },
      },
    });

    const result = await unlockUser(1);
    assert.equal(updatedFields.failedLoginAttempts, 0);
    assert.equal(updatedFields.lockedUntil, null);
    assert.equal(result.id, 1);
  });

  test('unlockUser throws NotFoundError for non-existent user', async () => {
    const unlockUser = createUnlockUser({
      userRepository: {
        async findById() { return null; },
        async update() { return null; },
      },
    });

    await assert.rejects(
      async () => unlockUser(999),
      /User not found/
    );
  });
});
