const { ValidationError, NotFoundError, AuthenticationError, AuthorizationError, ConflictError } = require('../../../utils/errorHandler');

const PRIVILEGED_ROLES = new Set(['admin', 'agent', 'socio']);

const buildRoleValidationError = () => {
  const error = new ValidationError('Please correct the following errors');
  error.errors = [
    {
      field: 'role',
      message: 'Public registration only allows the customer role',
    },
  ];

  return error;
};

const normalizeRegisterInput = (input) => {
  if (input && input.payload) {
    return {
      actor: input.actor || null,
      registrationSource: input.registrationSource || 'public',
      payload: input.payload,
    };
  }

  return {
    actor: null,
    registrationSource: 'public',
    payload: input,
  };
};

const sanitizeUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
});

/**
 * Create the registration use case for public customer signup and trusted admin provisioning.
 * @param {{ userRepository: object, customerProfileRepository: object, agentProfileRepository: object, passwordHasher: object, tokenService: object }} dependencies
 * @returns {Function}
 */
const createRegisterUser = ({
  userRepository,
  customerProfileRepository,
  agentProfileRepository,
  associateProfileRepository,
  passwordHasher,
  tokenService,
}) => async (input) => {
  const {
    actor,
    registrationSource,
    payload,
  } = normalizeRegisterInput(input);
  const {
    name,
    email,
    password,
    role,
    phone,
  } = payload;

  const isPrivilegedRole = PRIVILEGED_ROLES.has(role);
  const isPublicRegistration = registrationSource === 'public';

  if (isPublicRegistration && role !== 'customer') {
    throw buildRoleValidationError();
  }

  if (!isPublicRegistration && isPrivilegedRole && actor?.role !== 'admin') {
    throw new AuthorizationError('Privileged account creation requires admin access');
  }

  const existingUser = await userRepository.findByEmail(email);
  if (existingUser) {
    throw new ConflictError('User with this email already exists');
  }

  if (password.length < 6) {
    const remaining = 6 - password.length;
    throw new ValidationError(`Password must be at least 6 characters long. Please add ${remaining} more character${remaining > 1 ? 's' : ''}.`);
  }

  const hashedPassword = await passwordHasher.hash(password);
  const user = await userRepository.create({ name, email, password: hashedPassword, role });

  try {
    if (role === 'customer') {
      await customerProfileRepository.create({
        id: user.id,
        name,
        email,
        phone: phone || '',
        address: '',
      });
    }

    if (role === 'agent') {
      if (!phone) {
        throw new ValidationError('Phone number is required for agent registration');
      }

      await agentProfileRepository.create({
        id: user.id,
        name,
        email,
        phone,
      });
    }

    if (role === 'socio') {
      if (!phone) {
        throw new ValidationError('Phone number is required for socio registration');
      }

      if (!payload.associateId) {
        throw new ValidationError('Associate link is required for socio registration');
      }

      const linkedAssociate = await associateProfileRepository.update(payload.associateId, {
        name,
        email,
        ...(phone !== undefined ? { phone } : {}),
      });

      if (!linkedAssociate) {
        throw new NotFoundError('Associate');
      }

      await userRepository.update(user.id, { associateId: payload.associateId });
      user.associateId = payload.associateId;
    }
  } catch (error) {
    await userRepository.remove(user.id);
    throw error;
  }

  return {
    user: sanitizeUser(user),
    token: tokenService.sign({ id: user.id, role: user.role }),
  };
};

/**
 * Create the login use case that authenticates a user and returns a signed token.
 * @param {{ userRepository: object, passwordHasher: object, tokenService: object }} dependencies
 * @returns {Function}
 */
const createLoginUser = ({ userRepository, passwordHasher, tokenService }) => async ({ email, password }) => {
  const user = await userRepository.findByEmail(email);
  if (!user) {
    throw new AuthenticationError('Please enter correct email/password');
  }

  const isPasswordValid = await passwordHasher.compare(password, user.password);
  if (!isPasswordValid) {
    throw new AuthenticationError('Please enter correct email/password');
  }

  return {
    user: sanitizeUser(user),
    token: tokenService.sign({ id: user.id, role: user.role }),
  };
};

/**
 * Create the profile lookup use case for authenticated users.
 * @param {{ userRepository: object }} dependencies
 * @returns {Function}
 */
const createGetProfile = ({ userRepository }) => async (userId) => {
  const user = await userRepository.findById(userId);
  if (!user) {
    throw new NotFoundError('User');
  }

  return sanitizeUser(user);
};

/**
 * Create the profile update use case while keeping role-specific profile tables aligned.
 * @param {{ userRepository: object, customerProfileRepository: object, agentProfileRepository: object }} dependencies
 * @returns {Function}
 */
const createUpdateProfile = ({
  userRepository,
  customerProfileRepository,
  agentProfileRepository,
  associateProfileRepository,
}) => async (userId, { name, email, phone }) => {
  const user = await userRepository.findById(userId);
  if (!user) {
    throw new NotFoundError('User');
  }

  if (email && email !== user.email) {
    const existingUser = await userRepository.findByEmail(email);
    if (existingUser && existingUser.id !== userId) {
      throw new ConflictError('Email already in use');
    }
  }

  const updatedUser = await userRepository.update(userId, {
    name: name || user.name,
    email: email || user.email,
  });

  if (user.role === 'customer') {
    await customerProfileRepository.update(userId, {
      name: name || user.name,
      email: email || user.email,
      ...(phone !== undefined ? { phone } : {}),
    });
  }

  if (user.role === 'agent') {
    await agentProfileRepository.update(userId, {
      name: name || user.name,
      email: email || user.email,
      ...(phone !== undefined ? { phone } : {}),
    });
  }

  if (user.role === 'socio' && user.associateId) {
    await associateProfileRepository.update(user.associateId, {
      name: name || user.name,
      email: email || user.email,
      ...(phone !== undefined ? { phone } : {}),
    });
  }

  return sanitizeUser(updatedUser);
};

module.exports = {
  sanitizeUser,
  createRegisterUser,
  createLoginUser,
  createGetProfile,
  createUpdateProfile,
};
