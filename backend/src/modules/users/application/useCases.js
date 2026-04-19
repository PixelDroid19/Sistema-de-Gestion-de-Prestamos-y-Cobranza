const { ValidationError, NotFoundError, ConflictError } = require('@/utils/errorHandler');

const VALID_ROLES = ['admin', 'customer', 'socio'];

const sanitizeUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  associateId: user.associateId || null,
  isActive: user.isActive !== false,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const validateRole = (role) => {
  if (!VALID_ROLES.includes(role)) {
    throw new ValidationError(`Invalid role. Must be one of: ${VALID_ROLES.join(', ')}`);
  }
};

/**
 * Create the use case that lists all users (admin only)
 */
const createListUsers = ({ userRepository }) => async ({ pagination } = {}) => {
  if (pagination) {
    const result = await userRepository.findPage(pagination);
    return {
      items: result.items.map(sanitizeUser),
      pagination: result.pagination,
    };
  }

  const users = await userRepository.findAll();
  return users.map(sanitizeUser);
};

/**
 * Create the use case that gets a single user by ID
 */
const createGetUserById = ({ userRepository }) => async (userId) => {
  const user = await userRepository.findById(userId);
  if (!user) {
    throw new NotFoundError('User');
  }
  return sanitizeUser(user);
};

/**
 * Create the use case that updates a user's role or status
 */
const createUpdateUser = ({ userRepository }) => async (userId, payload) => {
  const user = await userRepository.findById(userId);
  if (!user) {
    throw new NotFoundError('User');
  }

  const updates = {};

  if (payload.role !== undefined) {
    validateRole(payload.role);
    updates.role = payload.role;
  }

  if (payload.name !== undefined) {
    if (payload.name.trim().length < 2) {
      throw new ValidationError('Name must be at least 2 characters long');
    }
    updates.name = payload.name.trim();
  }

  if (payload.email !== undefined) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(payload.email)) {
      throw new ValidationError('Please enter a valid email format');
    }
    const existing = await userRepository.findByEmail(payload.email);
    if (existing && existing.id !== user.id) {
      throw new ConflictError('Email already in use');
    }
    updates.email = payload.email;
  }

  const updatedUser = await userRepository.update(userId, updates);
  return sanitizeUser(updatedUser);
};

/**
 * Create the use case that deactivates a user
 */
const createDeactivateUser = ({ userRepository }) => async (userId) => {
  const user = await userRepository.findById(userId);
  if (!user) {
    throw new NotFoundError('User');
  }

  // Prevent self-deactivation
  // This would need the actor passed in, so we'll handle this at the router level

  const updatedUser = await userRepository.update(userId, { isActive: false });
  return sanitizeUser(updatedUser);
};

/**
 * Create the use case that reactivates a user
 */
const createReactivateUser = ({ userRepository }) => async (userId) => {
  const user = await userRepository.findById(userId);
  if (!user) {
    throw new NotFoundError('User');
  }

  const updatedUser = await userRepository.update(userId, { isActive: true });
  return sanitizeUser(updatedUser);
};

/**
 * Create the use case that unlocks a user account (admin only)
 */
const createUnlockUser = ({ userRepository }) => async (userId) => {
  const user = await userRepository.findById(userId);
  if (!user) {
    throw new NotFoundError('User');
  }

  const updatedUser = await userRepository.update(userId, {
    failedLoginAttempts: 0,
    lockedUntil: null,
  });

  return sanitizeUser(updatedUser);
};

module.exports = {
  createListUsers,
  createGetUserById,
  createUpdateUser,
  createDeactivateUser,
  createReactivateUser,
  createUnlockUser,
  sanitizeUser,
};
