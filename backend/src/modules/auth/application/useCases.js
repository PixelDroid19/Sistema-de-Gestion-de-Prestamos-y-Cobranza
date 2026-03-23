const { ValidationError, NotFoundError, AuthenticationError, AuthorizationError, ConflictError } = require('../../../utils/errorHandler');
const { APPLICATION_ROLES, normalizeApplicationRole } = require('../../shared/roles');

const PRIVILEGED_ROLES = new Set(['admin', 'socio']);

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
  role: normalizeApplicationRole(user.role),
});

const buildSupportedRolesError = () => {
  const error = new ValidationError('Please correct the following errors');
  error.errors = [
    {
      field: 'role',
      message: `Role must be one of: ${APPLICATION_ROLES.join(', ')}`,
    },
  ];

  return error;
};

const requireSupportedRole = (role, options) => {
  const normalizedRole = normalizeApplicationRole(role, options);

  if (!normalizedRole) {
    throw buildSupportedRolesError();
  }

  return normalizedRole;
};

/**
 * Create the registration use case for public customer signup and trusted admin provisioning.
 * @param {{ userRepository: object, customerProfileRepository: object, associateProfileRepository: object, passwordHasher: object, tokenService: object }} dependencies
 * @returns {Function}
 */
const createRegisterUser = ({
  userRepository,
  customerProfileRepository,
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
  const isPublicRegistration = registrationSource === 'public';

  if (isPublicRegistration && normalizeApplicationRole(role) !== 'customer') {
    throw buildRoleValidationError();
  }

  const normalizedRole = requireSupportedRole(role, { allowLegacyAliases: false });

  const isPrivilegedRole = PRIVILEGED_ROLES.has(normalizedRole);

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
  const user = await userRepository.create({ name, email, password: hashedPassword, role: normalizedRole });

  try {
    if (normalizedRole === 'customer') {
      await customerProfileRepository.create({
        id: user.id,
        name,
        email,
        phone: phone || '',
        address: '',
      });
    }

    if (normalizedRole === 'socio') {
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

  const sanitizedUser = sanitizeUser(user);

  return {
    user: sanitizedUser,
    token: tokenService.sign({ id: user.id, role: sanitizedUser.role }),
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

  requireSupportedRole(user.role);
  const sanitizedUser = sanitizeUser(user);

  return {
    user: sanitizedUser,
    token: tokenService.sign({ id: user.id, role: sanitizedUser.role }),
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
 * @param {{ userRepository: object, customerProfileRepository: object, associateProfileRepository: object }} dependencies
 * @returns {Function}
 */
const createUpdateProfile = ({
  userRepository,
  customerProfileRepository,
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

  const normalizedRole = requireSupportedRole(user.role);

  if (normalizedRole === 'customer') {
    await customerProfileRepository.update(userId, {
      name: name || user.name,
      email: email || user.email,
      ...(phone !== undefined ? { phone } : {}),
    });
  }

  if (normalizedRole === 'socio' && user.associateId) {
    await associateProfileRepository.update(user.associateId, {
      name: name || user.name,
      email: email || user.email,
      ...(phone !== undefined ? { phone } : {}),
    });
  }

  return sanitizeUser(updatedUser);
};

/**
 * Create the password change use case for authenticated users.
 * @param {{ userRepository: object, passwordHasher: object }} dependencies
 * @returns {Function}
 */
const createChangePassword = ({ userRepository, passwordHasher }) => async (userId, {
  currentPassword,
  nextPassword,
}) => {
  const user = await userRepository.findById(userId);
  if (!user) {
    throw new NotFoundError('User');
  }

  if (!currentPassword || !nextPassword) {
    throw new ValidationError('Current password and next password are required');
  }

  if (String(nextPassword).length < 6) {
    throw new ValidationError('Password must be at least 6 characters long');
  }

  const isCurrentPasswordValid = await passwordHasher.compare(currentPassword, user.password);
  if (!isCurrentPasswordValid) {
    throw new AuthenticationError('Current password is incorrect');
  }

  const isSamePassword = await passwordHasher.compare(nextPassword, user.password);
  if (isSamePassword) {
    throw new ValidationError('Next password must be different from the current password');
  }

  const hashedPassword = await passwordHasher.hash(nextPassword);
  await userRepository.update(userId, { password: hashedPassword });

  return { success: true };
};

module.exports = {
  sanitizeUser,
  createRegisterUser,
  createLoginUser,
  createGetProfile,
  createUpdateProfile,
  createChangePassword,
};
