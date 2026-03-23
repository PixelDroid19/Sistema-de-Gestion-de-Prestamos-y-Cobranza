const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  createRegisterUser,
  createLoginUser,
  createGetProfile,
  createUpdateProfile,
  createChangePassword,
} = require('../src/modules/auth/application/useCases');
const { AuthenticationError, AuthorizationError, ConflictError, ValidationError } = require('../src/utils/errorHandler');

test('createRegisterUser creates a customer-linked identity and token response', async () => {
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
    name: 'Ana Customer',
    email: 'ana@example.com',
    password: 'secret1',
    role: 'customer',
    phone: '+573001112233',
  });

  assert.equal(result.user.id, 15);
  assert.equal(result.user.role, 'customer');
  assert.equal(result.token, 'token:15:customer');
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
      password: 'secret1',
      role: 'agent',
      phone: '+573001112233',
    },
  }), (error) => {
    assert.ok(error instanceof ValidationError);
    assert.deepEqual(error.errors, [
      {
        field: 'role',
        message: 'Public registration only allows the customer role',
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
      password: 'secret1',
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
      password: 'secret1',
      role: 'admin',
    },
  });

  assert.equal(result.user.id, 45);
  assert.equal(result.user.role, 'admin');
  assert.equal(agentProfileCreateCalls, 0);
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
      password: 'secret1',
      role: 'admin',
    },
  }), AuthorizationError);
});

test('createRegisterUser links socio accounts to an associate record', async () => {
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

  const result = await registerUser({
    actor: { id: 1, role: 'admin' },
    registrationSource: 'trusted',
    payload: {
      name: 'Ana Socio',
      email: 'socio@example.com',
      password: 'secret1',
      role: 'socio',
      phone: '+573001112233',
      associateId: 14,
    },
  });

  assert.equal(result.user.role, 'socio');
  assert.equal(updatedAssociate.id, 14);
  assert.deepEqual(updatedUser, { id: 31, payload: { associateId: 14 } });
});

test('createLoginUser rejects an invalid password', async () => {
  const loginUser = createLoginUser({
    userRepository: {
      async findByEmail() {
        return { id: 9, email: 'ana@example.com', password: 'hashed-password', role: 'customer', name: 'Ana' };
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

test('createLoginUser normalizes legacy agent identities to admin during login', async () => {
  const loginUser = createLoginUser({
    userRepository: {
      async findByEmail() {
        return { id: 9, email: 'ana@example.com', password: 'hashed-password', role: 'agent', name: 'Ana Legacy Agent' };
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

  const result = await loginUser({ email: 'ana@example.com', password: 'secret1' });

  assert.deepEqual(result.user, {
    id: 9,
    email: 'ana@example.com',
    role: 'admin',
    name: 'Ana Legacy Agent',
  });
  assert.equal(result.token, 'token:9:admin');
});

test('createGetProfile returns the sanitized user profile', async () => {
  const getProfile = createGetProfile({
    userRepository: {
      async findById() {
        return {
          id: 11,
          name: 'Ana Customer',
          email: 'ana@example.com',
          role: 'customer',
          password: 'hidden',
        };
      },
    },
  });

  const profile = await getProfile(11);

  assert.deepEqual(profile, {
    id: 11,
    name: 'Ana Customer',
    email: 'ana@example.com',
    role: 'customer',
  });
});

test('createUpdateProfile updates a customer profile happy path', async () => {
  let updatedUserPayload;
  let updatedProfilePayload;

  const updateProfile = createUpdateProfile({
    userRepository: {
      async findById() {
        return { id: 3, name: 'Ana', email: 'ana@example.com', role: 'customer' };
      },
      async findByEmail() {
        return null;
      },
      async update(id, payload) {
        updatedUserPayload = { id, payload };
        return { id, role: 'customer', ...payload };
      },
    },
    customerProfileRepository: {
      async update(id, payload) {
        updatedProfilePayload = { id, payload };
        return { id, ...payload };
      },
    },
    agentProfileRepository: {
      async update() {
        throw new Error('agent repository should not be used');
      },
    },
  });

  const updatedUser = await updateProfile(3, {
    name: 'Ana Maria',
    email: 'ana.maria@example.com',
    phone: '+573001112244',
  });

  assert.deepEqual(updatedUser, {
    id: 3,
    name: 'Ana Maria',
    email: 'ana.maria@example.com',
    role: 'customer',
  });
  assert.deepEqual(updatedUserPayload, {
    id: 3,
    payload: {
      name: 'Ana Maria',
      email: 'ana.maria@example.com',
    },
  });
  assert.deepEqual(updatedProfilePayload, {
    id: 3,
    payload: {
      name: 'Ana Maria',
      email: 'ana.maria@example.com',
      phone: '+573001112244',
    },
  });
});

test('createUpdateProfile prevents duplicate email updates', async () => {
  const updateProfile = createUpdateProfile({
    userRepository: {
      async findById() {
        return { id: 3, name: 'Ana', email: 'ana@example.com', role: 'customer' };
      },
      async findByEmail() {
        return { id: 8, email: 'other@example.com' };
      },
      async update() {
        return { id: 3, name: 'Ana', email: 'other@example.com', role: 'customer' };
      },
    },
    customerProfileRepository: {
      async update() {},
    },
    agentProfileRepository: {
      async update() {},
    },
  });

  await assert.rejects(() => updateProfile(3, { email: 'other@example.com' }), ConflictError);
});

test('createChangePassword updates the stored password hash', async () => {
  const updates = [];

  const changePassword = createChangePassword({
    userRepository: {
      async findById() {
        return { id: 8, password: 'hashed-current' };
      },
      async update(id, payload) {
        updates.push({ id, payload });
        return { id, ...payload };
      },
    },
    passwordHasher: {
      async compare(candidate, hashed) {
        return (candidate === 'current-secret' && hashed === 'hashed-current')
          || (candidate === 'current-secret' && hashed === 'current-secret');
      },
      async hash(password) {
        return `hashed:${password}`;
      },
    },
  });

  const result = await changePassword(8, {
    currentPassword: 'current-secret',
    nextPassword: 'next-secret',
  });

  assert.deepEqual(result, { success: true });
  assert.deepEqual(updates, [{ id: 8, payload: { password: 'hashed:next-secret' } }]);
});

test('createChangePassword rejects an invalid current password', async () => {
  const changePassword = createChangePassword({
    userRepository: {
      async findById() {
        return { id: 8, password: 'hashed-current' };
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
    nextPassword: 'next-secret',
  }), AuthenticationError);
});
