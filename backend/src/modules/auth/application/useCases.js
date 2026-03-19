const { ValidationError, NotFoundError, AuthenticationError, AuthorizationError, ConflictError } = require('../../../utils/errorHandler');

const PRIVILEGED_ROLES = new Set(['admin', 'agent']);

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

const createRegisterUser = ({
  userRepository,
  customerProfileRepository,
  agentProfileRepository,
  passwordHasher,
  tokenService,
}) => async (input) => {
  const {
    actor,
    registrationSource,
    payload: { name, email, password, role, phone },
  } = normalizeRegisterInput(input);

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
  } catch (error) {
    await userRepository.remove(user.id);
    throw error;
  }

  return {
    user: sanitizeUser(user),
    token: tokenService.sign({ id: user.id, role: user.role }),
  };
};

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

const createGetProfile = ({ userRepository }) => async (userId) => {
  const user = await userRepository.findById(userId);
  if (!user) {
    throw new NotFoundError('User');
  }

  return sanitizeUser(user);
};

const createUpdateProfile = ({
  userRepository,
  customerProfileRepository,
  agentProfileRepository,
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

  return sanitizeUser(updatedUser);
};

module.exports = {
  sanitizeUser,
  createRegisterUser,
  createLoginUser,
  createGetProfile,
  createUpdateProfile,
};
