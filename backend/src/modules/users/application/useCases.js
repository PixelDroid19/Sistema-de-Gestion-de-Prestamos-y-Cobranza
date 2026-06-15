const { ValidationError, NotFoundError, ConflictError } = require('@/utils/errorHandler');
const { isAdministrativeLoginRole } = require('@/modules/shared/roles');
const { domainEventBus, EVENT_TYPES } = require('@/modules/shared/events');

const DUPLICATE_USER_EMAIL_MESSAGE = 'Ya existe un usuario con ese correo electrónico.';

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
  if (!isAdministrativeLoginRole(role)) {
    throw new ValidationError('Selecciona un rol administrativo válido.');
  }
};

/**
 * Create the use case that lists all users (admin only)
 */
const createListUsers = ({ userRepository }) => async ({ pagination, filters = {} } = {}) => {
  if (pagination) {
    const [result, summary] = await Promise.all([
      userRepository.findPage({ ...pagination, filters }),
      typeof userRepository.countSummary === 'function'
        ? userRepository.countSummary(filters)
        : Promise.resolve(null),
    ]);
    return {
      items: result.items.map(sanitizeUser),
      pagination: result.pagination,
      ...(summary ? { summary } : {}),
    };
  }

  const users = await userRepository.findAll(filters);
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
      throw new ValidationError('El nombre debe tener al menos 2 caracteres');
    }
    updates.name = payload.name.trim();
  }

  if (payload.email !== undefined) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(payload.email)) {
      throw new ValidationError('Ingresa un correo válido');
    }
    const existing = await userRepository.findByEmail(payload.email);
    if (existing && existing.id !== user.id) {
      throw new ConflictError(DUPLICATE_USER_EMAIL_MESSAGE);
    }
    updates.email = payload.email;
  }

  const updatedUser = await userRepository.update(userId, updates);
  domainEventBus.emit(EVENT_TYPES.USER_UPDATED, { userId, updates: Object.keys(updates) });
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
  domainEventBus.emit(EVENT_TYPES.USER_DEACTIVATED, { userId });
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
  domainEventBus.emit(EVENT_TYPES.USER_REACTIVATED, { userId });
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

  domainEventBus.emit(EVENT_TYPES.USER_UNLOCKED, { userId });
  return sanitizeUser(updatedUser);
};

module.exports = {
  createListUsers,
  createGetUserById,
  createUpdateUser,
  createDeactivateUser,
  createReactivateUser,
  createUnlockUser,
};
