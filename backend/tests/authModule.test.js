const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  createRegisterUser,
  createLoginUser,
  createGetProfile,
  createUpdateProfile,
  createChangePassword,
  createRefreshToken,
  createRegisterWithPermissions,
} = require('@/modules/auth/application/useCases');
const { AuthenticationError, AuthorizationError, ConflictError, ValidationError } = require('@/utils/errorHandler');

test('createRegisterUser creates an admin-provisioned employee identity and token response', async () => {
  const registerUser = createRegisterUser({
    userRepository: {
      async findByEmail() {
        return null;
      },
      async create(payload) {
        return { id: 15, ...payload };
      },
      async remove() {},
    },
    customerProfileRepository: {
      async create(payload) {
        return payload;
      },
    },
    agentProfileRepository: {
      async create() {
        throw new Error('agent repository should not be used');
      },
    },
    passwordHasher: {
      async hash(password) {
        return `hashed:${password}`;
      },
    },
    tokenService: {
      sign(payload) {
        return `token:${payload.id}:${payload.role}`;
      },
    },
  });

  const result = await registerUser({
    actor: { id: 1, role: 'admin' },
    registrationSource: 'admin',
    payload: {
      name: 'Ana Employee',
      email: 'ana@example.com',
      password: 'Secret123',
      role: 'employee',
    },
  });

  assert.equal(result.user.id, 15);
  assert.equal(result.user.role, 'employee');
  assert.equal(result.token, 'token:15:employee');
});

test('createLoginUser returns sanitized employee sessions', async () => {
  let signedPayload;
  const loginUser = createLoginUser({
    userRepository: {
      async findByLoginIdentifier() {
        return {
          id: 3,
          name: 'QA Employee',
          email: 'qa.employee@example.com',
          password: 'hashed-password',
          role: 'employee',
          failedLoginAttempts: 0,
          lockedUntil: null,
        };
      },
    },
    passwordHasher: {
      async compare() {
        return true;
      },
    },
    tokenService: {
      sign(payload) {
        signedPayload = payload;
        return `token:${payload.id}:${payload.role}`;
      },
    },
  });

  const result = await loginUser({ email: 'qa.employee@example.com', password: 'Admin1234' });

  assert.equal(result.user.role, 'employee');
  assert.deepEqual(signedPayload, {
    id: 3,
    role: 'employee',
    name: 'QA Employee',
  });
});

test('createRefreshToken renews employee access tokens', async () => {
  let tokenPairArgs;
  const refreshToken = createRefreshToken({
    tokenService: {
      async verifyRefreshToken() {
        return { userId: 3 };
      },
      generateTokenPair(userId, role, extraPayload) {
        tokenPairArgs = { userId, role, extraPayload };
        return {
          accessToken: 'new-access-token',
          refreshToken: 'new-refresh-token',
        };
      },
    },
    refreshTokenRepository: {
      async revoke() {
        return true;
      },
      async create() {
        return true;
      },
    },
    userRepository: {
      async findById() {
        return {
          id: 3,
          name: 'QA Employee',
          email: 'qa.employee@example.com',
          role: 'employee',
        };
      },
    },
  });

  const result = await refreshToken({ refreshToken: 'refresh-token' });

  assert.equal(result.accessToken, 'new-access-token');
  assert.equal(result.refreshToken, 'new-refresh-token');
  assert.deepEqual(tokenPairArgs, {
    userId: 3,
    role: 'employee',
    extraPayload: {
      name: 'QA Employee',
    },
  });
});

test('createRegisterUser provisions employee accounts without customer profile side effects', async () => {
  const callOrder = [];

  const registerUser = createRegisterUser({
    userRepository: {
      async findByEmail() {
        return null;
      },
      async syncPrimaryKeySequenceWithCustomerProfiles() {
        callOrder.push('sync');
      },
      async create(payload) {
        callOrder.push('create-user');
        return { id: 27, ...payload };
      },
      async remove() {},
    },
    customerProfileRepository: {
      async create(payload) {
        callOrder.push(`create-customer:${payload.id}`);
        return payload;
      },
    },
    associateProfileRepository: {},
    passwordHasher: {
      async hash(password) {
        return `hashed:${password}`;
      },
    },
    tokenService: {
      sign(payload) {
        return `token:${payload.id}:${payload.role}`;
      },
    },
  });

  const result = await registerUser({
    actor: { id: 1, role: 'admin' },
    registrationSource: 'admin',
    payload: {
      name: 'Portal Employee',
      email: 'portal.employee@example.com',
      password: 'Secret123',
      role: 'employee',
    },
  });

  assert.equal(result.user.id, 27);
  assert.deepEqual(callOrder, ['create-user']);
});

test('createRegisterUser rejects privileged public signup even when validation is bypassed', async () => {
  let createdUser = false;

  const registerUser = createRegisterUser({
    userRepository: {
      async findByEmail() {
        return null;
      },
      async create() {
        createdUser = true;
        return { id: 15 };
      },
      async remove() {},
    },
    customerProfileRepository: {
      async create() {
        throw new Error('customer repository should not be used');
      },
    },
    agentProfileRepository: {
      async create() {
        throw new Error('agent repository should not be used');
      },
    },
    passwordHasher: {
      async hash(password) {
        return `hashed:${password}`;
      },
    },
    tokenService: {
      sign() {
        return 'unused';
      },
    },
  });

  await assert.rejects(() => registerUser({
    actor: null,
    registrationSource: 'public',
    payload: {
      name: 'Ana Agent',
      email: 'agent@example.com',
      password: 'Secret123',
      role: 'agent',
      phone: '+573001112233',
    },
  }), (error) => {
    assert.ok(error instanceof ValidationError);
    assert.deepEqual(error.errors, [
      {
        field: 'role',
        message: 'Public registration is disabled. An administrator must create employee accounts.',
      },
    ]);
    return true;
  });

  assert.equal(createdUser, false);
});

test('createRegisterUser allows trusted admins to create privileged admin accounts', async () => {
  let agentProfileCreateCalls = 0;

  const registerUser = createRegisterUser({
    userRepository: {
      async findByEmail() {
        return null;
      },
      async create(payload) {
        return { id: 21, ...payload };
      },
      async remove() {},
    },
    customerProfileRepository: {
      async create() {
        throw new Error('customer repository should not be used');
      },
    },
    agentProfileRepository: {
      async create() {
        agentProfileCreateCalls += 1;
        throw new Error('agent repository should not be used');
      },
    },
    passwordHasher: {
      async hash(password) {
        return `hashed:${password}`;
      },
    },
    tokenService: {
      sign(payload) {
        return `token:${payload.id}:${payload.role}`;
      },
    },
  });

  const result = await registerUser({
    actor: { id: 1, role: 'admin' },
    registrationSource: 'trusted',
    payload: {
      name: 'Ana Admin',
      email: 'admin@example.com',
      password: 'Secret123',
      role: 'admin',
    },
  });

  assert.equal(result.user.role, 'admin');
  assert.equal(result.token, 'token:21:admin');
  assert.equal(agentProfileCreateCalls, 0);
});

test('createRegisterUser accepts admin registrationSource for privileged provisioning', async () => {
  let agentProfileCreateCalls = 0;

  const registerUser = createRegisterUser({
    userRepository: {
      async findByEmail() {
        return null;
      },
      async create(payload) {
        return { id: 45, ...payload };
      },
      async remove() {},
    },
    customerProfileRepository: { async create() {} },
    agentProfileRepository: {
      async create() {
        agentProfileCreateCalls += 1;
        throw new Error('agent repository should not be used');
      },
    },
    passwordHasher: {
      async hash(password) {
        return `hashed:${password}`;
      },
    },
    tokenService: {
      sign(payload) {
        return `token:${payload.id}:${payload.role}`;
      },
    },
  });

  const result = await registerUser({
    actor: { id: 1, role: 'admin' },
    registrationSource: 'admin',
    payload: {
      name: 'Provisioned Admin',
      email: 'provisioned.admin@example.com',
      password: 'Secret123',
      role: 'admin',
    },
  });

  assert.equal(result.user.id, 45);
  assert.equal(result.user.role, 'admin');
  assert.equal(agentProfileCreateCalls, 0);
});

test('createRegisterUser rejects roleIds payloads without canonical role', async () => {
  let linkedAssociateId = null;

  const registerUser = createRegisterUser({
    userRepository: {
      async findByEmail() {
        return null;
      },
      async create(payload) {
        return { id: 88, ...payload };
      },
      async update() {
        return {};
      },
      async remove() {},
    },
    customerProfileRepository: { async create() {} },
    associateProfileRepository: {
      async update(id) {
        linkedAssociateId = id;
        return { id };
      },
    },
    passwordHasher: {
      async hash(password) {
        return `hashed:${password}`;
      },
    },
    tokenService: {
      sign(payload) {
        return `token:${payload.id}:${payload.role}`;
      },
    },
  });

  await assert.rejects(() => registerUser({
    actor: { id: 1, role: 'admin' },
    registrationSource: 'admin',
    payload: {
      name: 'Partner Without Canonical Role',
      email: 'partner-no-role@example.com',
      password: 'Secret123',
      roleIds: ['PARTNER'],
      phone: '+573001112233',
      associateId: 61,
    },
  }), /Please correct the following errors/);

  assert.equal(linkedAssociateId, null);
});

test('createRegisterUser blocks non-admin actors from creating privileged accounts in trusted flows', async () => {
  const registerUser = createRegisterUser({
    userRepository: {
      async findByEmail() {
        return null;
      },
      async create() {
        throw new Error('user repository should not be used');
      },
      async remove() {},
    },
    customerProfileRepository: {
      async create() {},
    },
    agentProfileRepository: {
      async create() {},
    },
    passwordHasher: {
      async hash(password) {
        return `hashed:${password}`;
      },
    },
    tokenService: {
      sign() {
        return 'unused';
      },
    },
  });

  await assert.rejects(() => registerUser({
    actor: { id: 7, role: 'customer' },
    registrationSource: 'trusted',
    payload: {
      name: 'Ana Admin',
      email: 'admin@example.com',
      password: 'Secret123',
      role: 'admin',
    },
  }), AuthorizationError);
});

test('createRegisterUser rejects socio account provisioning in administrative auth', async () => {
  let updatedAssociate;
  let updatedUser;

  const registerUser = createRegisterUser({
    userRepository: {
      async findByEmail() {
        return null;
      },
      async create(payload) {
        return { id: 31, ...payload };
      },
      async update(id, payload) {
        updatedUser = { id, payload };
        return { id, ...payload };
      },
      async remove() {},
    },
    customerProfileRepository: { async create() {} },
    agentProfileRepository: { async create() {} },
    associateProfileRepository: {
      async update(id, payload) {
        updatedAssociate = { id, payload };
        return { id, ...payload };
      },
    },
    passwordHasher: {
      async hash(password) {
        return `hashed:${password}`;
      },
    },
    tokenService: {
      sign(payload) {
        return `token:${payload.id}:${payload.role}`;
      },
    },
  });

  await assert.rejects(() => registerUser({
    actor: { id: 1, role: 'admin' },
    registrationSource: 'trusted',
    payload: {
      name: 'Ana Socio',
      email: 'socio@example.com',
      password: 'Secret123',
      role: 'socio',
      phone: '+573001112233',
      associateId: 14,
    },
  }), (error) => {
    assert.ok(error instanceof ValidationError);
    assert.deepEqual(error.errors, [
      { field: 'role', message: 'Administrative users must be admin or employee' },
    ]);
    return true;
  });

  assert.equal(updatedAssociate, undefined);
  assert.equal(updatedUser, undefined);
});

test('createLoginUser rejects an invalid password', async () => {
  const loginUser = createLoginUser({
    userRepository: {
      async findByEmail() {
        return { id: 9, email: 'ana@example.com', password: 'hashed-password', role: 'customer', name: 'Ana', failedLoginAttempts: 0, lockedUntil: null };
      },
      async update() {
        return {};
      },
    },
    passwordHasher: {
      async compare() {
        return false;
      },
    },
    tokenService: {
      sign() {
        return 'unused';
      },
    },
  });

  await assert.rejects(() => loginUser({ email: 'ana@example.com', password: 'wrong-pass' }), AuthenticationError);
});

test('createLoginUser rejects non-administrative roles during login', async () => {
  const loginUser = createLoginUser({
    userRepository: {
      async findByLoginIdentifier() {
        return { id: 9, email: 'ana@example.com', password: 'hashed-password', role: 'agent', name: 'Ana Agent', failedLoginAttempts: 0, lockedUntil: null };
      },
      async update() {
        return {};
      },
    },
    passwordHasher: {
      async compare() {
        return true;
      },
    },
    tokenService: {
      sign(payload) {
        return `token:${payload.id}:${payload.role}`;
      },
    },
  });

  try {
    await loginUser({ email: 'ana@example.com', password: 'Secret1' });
    assert.fail('Should have rejected non-administrative role');
  } catch (error) {
    assert.equal(error.statusCode, 401);
    assert.equal(error.message, 'Please enter correct email/password');
  }
});

test('createLoginUser accepts username when email is not provided', async () => {
  const loginUser = createLoginUser({
    userRepository: {
      async findByLoginIdentifier(identifier) {
        assert.equal(identifier, 'ana.user');
        return {
          id: 19,
          name: 'ana.user',
          email: 'ana.user@example.com',
          password: 'hashed-password',
          role: 'employee',
          failedLoginAttempts: 0,
          lockedUntil: null,
        };
      },
      async update() {
        return {};
      },
    },
    passwordHasher: {
      async compare() {
        return true;
      },
    },
    tokenService: {
      sign(payload) {
        return `token:${payload.id}:${payload.role}`;
      },
    },
  });

  const result = await loginUser({ username: 'ana.user', password: 'Secret123' });
  assert.equal(result.user.id, 19);
  assert.equal(result.user.role, 'employee');
});

test('createGetProfile returns the sanitized user profile', async () => {
  const getProfile = createGetProfile({
    userRepository: {
      async findById() {
        return {
          id: 11,
          name: 'Ana Employee',
          email: 'ana@example.com',
          role: 'employee',
          password: 'hidden',
        };
      },
    },
  });

  const profile = await getProfile(11);

  assert.deepEqual(profile, {
    id: 11,
    name: 'Ana Employee',
    email: 'ana@example.com',
    role: 'employee',
  });
});

test('createUpdateProfile updates an administrative profile happy path', async () => {
  let updatedUserPayload;

  const updateProfile = createUpdateProfile({
    userRepository: {
      async findById() {
        return { id: 3, name: 'Ana', email: 'ana@example.com', role: 'employee' };
      },
      async findByEmail() {
        return null;
      },
      async update(id, payload) {
        updatedUserPayload = { id, payload };
        return { id, role: 'employee', ...payload };
      },
    },
  });

  const updatedUser = await updateProfile(3, {
    name: 'Ana Maria',
    email: 'ana.maria@example.com',
  });

  assert.deepEqual(updatedUser, {
    id: 3,
    name: 'Ana Maria',
    email: 'ana.maria@example.com',
    role: 'employee',
  });
  assert.deepEqual(updatedUserPayload, {
    id: 3,
    payload: {
      name: 'Ana Maria',
      email: 'ana.maria@example.com',
    },
  });
});

test('createUpdateProfile prevents duplicate email updates', async () => {
  const updateProfile = createUpdateProfile({
    userRepository: {
      async findById() {
        return { id: 3, name: 'Ana', email: 'ana@example.com', role: 'employee' };
      },
      async findByEmail() {
        return { id: 8, email: 'other@example.com' };
      },
      async update() {
        return { id: 3, name: 'Ana', email: 'other@example.com', role: 'employee' };
      },
    },
  });

  await assert.rejects(() => updateProfile(3, { email: 'other@example.com' }), ConflictError);
});

test('createChangePassword updates the stored password hash', async () => {
  const updates = [];

  const changePassword = createChangePassword({
    userRepository: {
      async findById() {
        return { id: 8, role: 'admin', password: 'hashed-Current1' };
      },
      async update(id, payload) {
        updates.push({ id, payload });
        return { id, ...payload };
      },
    },
    passwordHasher: {
      async compare(candidate, hashed) {
        // Simulate: candidate matches hashed value
        return candidate === 'Current1' && hashed === 'hashed-Current1';
      },
      async hash(password) {
        return `hashed:${password}`;
      },
    },
  });

  const result = await changePassword(8, {
    currentPassword: 'Current1',
    nextPassword: 'Newpass1',
  });

  assert.deepEqual(result, { success: true });
  assert.deepEqual(updates, [{ id: 8, payload: { password: 'hashed:Newpass1' } }]);
});

test('createChangePassword rejects an invalid current password', async () => {
  const changePassword = createChangePassword({
    userRepository: {
      async findById() {
        return { id: 8, role: 'admin', password: 'hashed-Current1' };
      },
      async update() {
        throw new Error('update should not be called');
      },
    },
    passwordHasher: {
      async compare() {
        return false;
      },
      async hash() {
        throw new Error('hash should not be called');
      },
    },
  });

  await assert.rejects(() => changePassword(8, {
    currentPassword: 'wrong-secret',
    nextPassword: 'Newpass1',
  }), AuthenticationError);
});

test('createChangePassword rejects weak passwords that do not meet complexity requirements', async () => {
  const changePassword = createChangePassword({
    userRepository: {
      async findById() {
        return { id: 8, role: 'admin', password: 'hashed-Current1' };
      },
      async update() {
        throw new Error('update should not be called');
      },
    },
    passwordHasher: {
      async compare() {
        return true;
      },
      async hash() {
        throw new Error('hash should not be called');
      },
    },
  });

  // Password too short
  await assert.rejects(() => changePassword(8, {
    currentPassword: 'Current1',
    nextPassword: 'Short1',
  }), (error) => {
    assert.ok(error instanceof ValidationError);
    assert.ok(error.errors.some(e => e.message.includes('8 characters')));
    return true;
  });

  // Password without uppercase
  await assert.rejects(() => changePassword(8, {
    currentPassword: 'Current1',
    nextPassword: 'newpassword1',
  }), (error) => {
    assert.ok(error instanceof ValidationError);
    assert.ok(error.errors.some(e => e.message.includes('uppercase')));
    return true;
  });

  // Password without number
  await assert.rejects(() => changePassword(8, {
    currentPassword: 'Current1',
    nextPassword: 'NewPassword',
  }), (error) => {
    assert.ok(error instanceof ValidationError);
    assert.ok(error.errors.some(e => e.message.includes('number')));
    return true;
  });
});

test('createRegisterWithPermissions creates user with explicit permissions', async () => {
  const registerWithPermissions = createRegisterWithPermissions({
    userRepository: {
      async findByEmail() {
        return null;
      },
      async create(payload) {
        return { id: 25, ...payload };
      },
      async remove() {},
    },
    customerProfileRepository: {
      async create(payload) {
        return payload;
      },
    },
    associateProfileRepository: {
      async update() {
        return {};
      },
    },
    passwordHasher: {
      async hash(password) {
        return `hashed:${password}`;
      },
    },
    tokenService: {
      sign(payload) {
        return `token:${payload.id}:${payload.role}`;
      },
    },
    userPermissionRepository: {
      async grantBatch({ userId, permissionIds }) {
        return permissionIds.map(id => ({ id, userId, permissionId: id }));
      },
    },
    rolePermissionRepository: {
      async findByRole() {
        return [];
      },
    },
    permissionRepository: {
      async findAll() {
        return [
          { id: 1, name: 'READ_USERS' },
          { id: 2, name: 'WRITE_USERS' },
        ];
      },
    },
  });

  const result = await registerWithPermissions({
    actor: { id: 1, role: 'admin' },
    payload: {
      name: 'John Admin',
      email: 'john@example.com',
      password: 'Secret123',
      role: 'admin',
      permissions: ['READ_USERS', 'WRITE_USERS'],
    },
  });

  assert.equal(result.user.id, 25);
  assert.equal(result.user.role, 'admin');
  assert.deepEqual(result.permissions, ['READ_USERS', 'WRITE_USERS']);
});

test('createRegisterWithPermissions derives default permissions when not provided', async () => {
  const registerWithPermissions = createRegisterWithPermissions({
    userRepository: {
      async findByEmail() {
        return null;
      },
      async create(payload) {
        return { id: 26, ...payload };
      },
      async remove() {},
      async update() {
        return {};
      },
    },
    customerProfileRepository: {
      async create(payload) {
        return payload;
      },
    },
    associateProfileRepository: {
      async update() {
        return {};
      },
    },
    passwordHasher: {
      async hash(password) {
        return `hashed:${password}`;
      },
    },
    tokenService: {
      sign(payload) {
        return `token:${payload.id}:${payload.role}`;
      },
    },
    userPermissionRepository: {
      async grantBatch({ userId, permissionIds }) {
        return permissionIds.map(id => ({ id, userId, permissionId: id }));
      },
    },
    rolePermissionRepository: {
      async findByRole(role) {
        if (role === 'employee') {
          return [
            { Permission: { id: 3, name: 'READ_CREDITOS' } },
            { Permission: { id: 4, name: 'READ_REPORTES' } },
          ];
        }
        return [];
      },
    },
    permissionRepository: {
      async findAll() {
        return [
          { id: 3, name: 'READ_CREDITOS' },
          { id: 4, name: 'READ_REPORTES' },
        ];
      },
    },
  });

  const result = await registerWithPermissions({
    actor: { id: 1, role: 'admin' },
    payload: {
      name: 'Jane Employee',
      email: 'jane@example.com',
      password: 'Secret123',
      role: 'employee',
    },
  });

  assert.equal(result.user.id, 26);
  assert.equal(result.user.role, 'employee');
  assert.deepEqual(result.permissions, ['READ_CREDITOS', 'READ_REPORTES']);
});

test('createRegisterWithPermissions creates employee accounts without customer profile side effects', async () => {
  const callOrder = [];

  const registerWithPermissions = createRegisterWithPermissions({
    userRepository: {
      async findByEmail() {
        return null;
      },
      async syncPrimaryKeySequenceWithCustomerProfiles() {
        callOrder.push('sync');
      },
      async create(payload) {
        callOrder.push('create-user');
        return { id: 44, ...payload };
      },
      async remove() {},
    },
    customerProfileRepository: {
      async create(payload) {
        callOrder.push(`create-customer:${payload.id}`);
        return payload;
      },
    },
    associateProfileRepository: {
      async update() {
        return {};
      },
    },
    passwordHasher: {
      async hash(password) {
        return `hashed:${password}`;
      },
    },
    tokenService: {
      sign(payload) {
        return `token:${payload.id}:${payload.role}`;
      },
    },
    userPermissionRepository: {
      async grantBatch() {
        return [];
      },
    },
    rolePermissionRepository: {
      async findByRole() {
        return [];
      },
    },
    permissionRepository: {
      async findAll() {
        return [];
      },
    },
  });

  const result = await registerWithPermissions({
    actor: { id: 1, role: 'admin' },
    payload: {
      name: 'Permitted Employee',
      email: 'permitted.employee@example.com',
      password: 'Secret123',
      role: 'employee',
    },
  });

  assert.equal(result.user.id, 44);
  assert.deepEqual(result.permissions, []);
  assert.deepEqual(callOrder, ['create-user']);
});

test('createRegisterWithPermissions throws AuthorizationError for non-admin actor', async () => {
  const registerWithPermissions = createRegisterWithPermissions({
    userRepository: {},
    customerProfileRepository: {},
    associateProfileRepository: {},
    passwordHasher: {},
    tokenService: {},
    userPermissionRepository: {},
    rolePermissionRepository: {},
    permissionRepository: {},
  });

  await assert.rejects(() => registerWithPermissions({
    actor: { id: 2, role: 'customer' },
    payload: {
      name: 'Test User',
      email: 'test@example.com',
      password: 'Secret123',
      role: 'admin',
    },
  }), (error) => {
    assert.ok(error instanceof AuthorizationError);
    return true;
  });
});

test('createRegisterWithPermissions throws ConflictError for duplicate email', async () => {
  const registerWithPermissions = createRegisterWithPermissions({
    userRepository: {
      async findByEmail() {
        return { id: 5, email: 'existing@example.com' };
      },
    },
    customerProfileRepository: {},
    associateProfileRepository: {},
    passwordHasher: {},
    tokenService: {},
    userPermissionRepository: {},
    rolePermissionRepository: {},
    permissionRepository: {},
  });

  await assert.rejects(() => registerWithPermissions({
    actor: { id: 1, role: 'admin' },
    payload: {
      name: 'Test User',
      email: 'existing@example.com',
      password: 'Secret123',
      role: 'admin',
    },
  }), (error) => {
    assert.ok(error instanceof ConflictError);
    return true;
  });
});
