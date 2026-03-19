const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  createRegisterUser,
  createLoginUser,
  createGetProfile,
  createUpdateProfile,
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

test('createRegisterUser allows trusted admins to create privileged agent accounts', async () => {
  let createdAgentProfile;

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
      async create(payload) {
        createdAgentProfile = payload;
        return payload;
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
      name: 'Ana Agent',
      email: 'agent@example.com',
      password: 'secret1',
      role: 'agent',
      phone: '+573001112233',
    },
  });

  assert.equal(result.user.role, 'agent');
  assert.equal(result.token, 'token:21:agent');
  assert.deepEqual(createdAgentProfile, {
    id: 21,
    name: 'Ana Agent',
    email: 'agent@example.com',
    phone: '+573001112233',
  });
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
      name: 'Ana Agent',
      email: 'agent@example.com',
      password: 'secret1',
      role: 'agent',
      phone: '+573001112233',
    },
  }), AuthorizationError);
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
