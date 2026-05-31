const { ValidationError, NotFoundError, AuthenticationError, AuthorizationError, ConflictError } = require('@/utils/errorHandler');
const { isAdministrativeLoginRole, normalizeApplicationRole } = require('@/modules/shared/roles');
const { domainEventBus, EVENT_TYPES } = require('@/modules/shared/events');

const PRIVILEGED_ROLES = new Set(['admin']);
const EMPLOYEE_ROLE = 'employee';
const DUPLICATE_USER_EMAIL_MESSAGE = 'Ya existe un usuario con ese correo electrónico.';
const ADMIN_ACCOUNT_CREATION_REQUIRED_MESSAGE = 'Solo un administrador puede crear cuentas administrativas.';
const PASSWORD_REQUIREMENTS_MESSAGE = 'La contraseña no cumple los requisitos.';
const INVALID_LOGIN_MESSAGE = 'Correo o contraseña incorrectos.';
const INACTIVE_ACCOUNT_MESSAGE = 'Esta cuenta está inactiva.';
const CHANGE_PASSWORD_REQUIRED_MESSAGE = 'Ingresa la contraseña actual y la nueva contraseña.';
const CURRENT_PASSWORD_INCORRECT_MESSAGE = 'La contraseña actual es incorrecta.';
const NEXT_PASSWORD_DIFFERENT_MESSAGE = 'La nueva contraseña debe ser diferente de la actual.';
const PERMISSIONS_ASSIGN_REQUIRED_MESSAGE = 'Solo un administrador puede asignar permisos.';

// Progressive login delay configuration
const LOGIN_DELAY_CONFIG = {
  baseDelayMs: 100,        // Base delay: 100ms
  maxDelayMs: 30000,      // Maximum delay cap: 30 seconds
  maxAttempts: 10,         // After this many attempts, delay caps at max
};

// Password strength requirements
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_COMPLEXITY = {
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: false, // Optional
};

/**
 * Calculate progressive login delay based on failed attempt count.
 * Formula: min(baseDelayMs * 2^attempts, maxDelayMs)
 * @param {number} attempts - Number of consecutive failed attempts
 * @returns {number} Delay in milliseconds
 */
const calculateLoginDelay = (attempts) => {
  if (attempts <= 0) return 0;
  const delay = LOGIN_DELAY_CONFIG.baseDelayMs * Math.pow(2, attempts - 1);
  return Math.min(delay, LOGIN_DELAY_CONFIG.maxDelayMs);
};

/**
 * Validate password complexity and return strength indicator.
 * @param {string} password - Password to validate
 * @returns {{ valid: boolean, strength?: 'weak'|'medium'|'strong', errors?: string[] }}
 */
const validatePasswordStrength = (password) => {
  const errors = [];

  if (!password || typeof password !== 'string') {
    return { valid: false, errors: ['La contraseña es obligatoria'] };
  }

  if (password.length < PASSWORD_MIN_LENGTH) {
    errors.push(`La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres`);
  }

  if (PASSWORD_COMPLEXITY.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('La contraseña debe incluir al menos una mayúscula');
  }

  if (PASSWORD_COMPLEXITY.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('La contraseña debe incluir al menos una minúscula');
  }

  if (PASSWORD_COMPLEXITY.requireNumbers && !/[0-9]/.test(password)) {
    errors.push('La contraseña debe incluir al menos un número');
  }

  if (PASSWORD_COMPLEXITY.requireSpecialChars && !/[!@#$%^&*()_+\-={};'":\\|,.<>/?]/.test(password)) {
    errors.push('La contraseña debe incluir al menos un carácter especial');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // Calculate strength
  let strength = 'weak';
  let score = 0;

  if (password.length >= 10) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[!@#$%^&*()_+\-={};'":\\|,.<>/?]/.test(password)) score++;

  if (score >= 5) strength = 'strong';
  else if (score >= 3) strength = 'medium';

  return { valid: true, strength };
};

const buildPublicRegistrationDisabledError = () => {
  const error = new ValidationError('Corrige los errores indicados');
  error.errors = [
    {
      field: 'role',
      message: 'El registro público está deshabilitado. Un administrador debe crear las cuentas de empleados.',
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

const normalizeLoginCredentials = (credentials = {}) => {
  const email = typeof credentials.email === 'string' ? credentials.email.trim() : '';
  const username = typeof credentials.username === 'string' ? credentials.username.trim() : '';
  const identifier = email || username;

  return {
    ...credentials,
    email,
    username,
    identifier,
  };
};

const sanitizeUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: normalizeApplicationRole(user.role),
  ...(user.associateId !== undefined ? { associateId: user.associateId } : {}),
});

const buildTokenPayload = (user) => {
  const sanitizedUser = sanitizeUser(user);

  return {
    id: sanitizedUser.id,
    role: sanitizedUser.role,
    name: sanitizedUser.name,
    ...(sanitizedUser.associateId !== undefined ? { associateId: sanitizedUser.associateId } : {}),
  };
};

const buildSupportedRolesError = () => {
  const error = new ValidationError('Corrige los errores indicados');
  error.errors = [
    {
      field: 'role',
      message: 'Selecciona un rol administrativo válido.',
    },
  ];

  return error;
};

const buildAdministrativeRoleValidationError = () => {
  const error = new ValidationError('Corrige los errores indicados');
  error.errors = [
    {
      field: 'role',
      message: 'Selecciona un rol administrativo válido.',
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

const requireAdministrativeLoginRole = (role) => {
  const normalizedRole = requireSupportedRole(role);
  if (!isAdministrativeLoginRole(normalizedRole)) {
    throw buildAdministrativeRoleValidationError();
  }

  return normalizedRole;
};

/**
 * Create the registration use case for trusted administrative account provisioning.
 * Public signup is disabled; only admin-created admin/employee accounts are valid.
 * @param {{ userRepository: object, passwordHasher: object, tokenService: object, auditService?: object }} dependencies
 * @returns {Function}
 */
const createRegisterUser = ({
  userRepository,
  passwordHasher,
  tokenService,
  auditService,
}) => async (input) => {
  const {
    actor,
    registrationSource,
    payload,
  } = normalizeRegisterInput(input);
  const { name, email, password, role } = payload;
  const resolvedRole = role;
  const isPublicRegistration = registrationSource === 'public';

  if (isPublicRegistration) {
    throw buildPublicRegistrationDisabledError();
  }

  const normalizedRole = requireAdministrativeLoginRole(resolvedRole);

  if (!isPublicRegistration && (PRIVILEGED_ROLES.has(normalizedRole) || normalizedRole === EMPLOYEE_ROLE) && actor?.role !== 'admin') {
    throw new AuthorizationError(ADMIN_ACCOUNT_CREATION_REQUIRED_MESSAGE);
  }

  const existingUser = await userRepository.findByEmail(email);
  if (existingUser) {
    throw new ConflictError(DUPLICATE_USER_EMAIL_MESSAGE);
  }

  const passwordValidation = validatePasswordStrength(password);
  if (!passwordValidation.valid) {
    const error = new ValidationError(PASSWORD_REQUIREMENTS_MESSAGE);
    error.errors = passwordValidation.errors.map(msg => ({ field: 'password', message: msg }));
    throw error;
  }

  const hashedPassword = await passwordHasher.hash(password);
  const user = await userRepository.create({ name, email, password: hashedPassword, role: normalizedRole });

  // Audit logging for user registration
  if (auditService) {
    await auditService.log({
      actor,
      action: 'CREATE',
      module: 'AUTH',
      entityId: String(user.id),
      entityType: 'User',
      newData: { email, role: normalizedRole, registrationSource },
      metadata: { name },
      req: input?.req,
    });
  }

  const sanitizedUser = sanitizeUser(user);

  // Prefer the short-lived access-token generator; test adapters may expose sign only.
  const accessToken = typeof tokenService.generateAccessToken === 'function'
    ? tokenService.generateAccessToken(user.id, user.role, buildTokenPayload(user))
    : tokenService.sign(buildTokenPayload(user));

  return {
    user: sanitizedUser,
    token: accessToken,
  };
};

/**
 * Create the login use case that authenticates a user and returns a signed token.
 * Implements progressive login delays and account lockout for security.
 * @param {{ userRepository: object, passwordHasher: object, tokenService: object, refreshTokenRepository?: object, auditService?: object }} dependencies
 * @returns {Function}
 */
const createLoginUser = ({ userRepository, passwordHasher, tokenService, refreshTokenRepository, auditService }) => async (credentials = {}) => {
  const { AccountLockedError, formatAccountLockedMessage } = require('@/utils/errorHandler');
  const { logSecurity } = require('@/utils/logger');

  const { email, username, identifier, password, req } = normalizeLoginCredentials(credentials);

  const LOCKOUT_THRESHOLD = 5; // Lock after 5 consecutive failed attempts
  const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

  const user = typeof userRepository.findByLoginIdentifier === 'function'
    ? await userRepository.findByLoginIdentifier(identifier)
    : await userRepository.findByEmail(email || username);
  if (!user) {
    // Don't reveal whether identifier exists - generic error message
    throw new AuthenticationError(INVALID_LOGIN_MESSAGE);
  }

  const now = new Date();
  const lockedUntil = user.lockedUntil ? new Date(user.lockedUntil) : null;
  const isCurrentlyLocked = lockedUntil && lockedUntil > now;
  const isExpiredLockout = lockedUntil && lockedUntil <= now;

  // Check if account is currently locked
  if (isCurrentlyLocked) {
    const remainingMinutes = Math.ceil((lockedUntil - now) / 60000);
    logSecurity('auth.login.account_locked', {
      userId: user.id,
      email: user.email,
      lockedUntil: user.lockedUntil,
    });
    domainEventBus.emit(EVENT_TYPES.AUTH_ACCOUNT_LOCKED, {
      userId: user.id,
      remainingMinutes,
    });
    const error = new AccountLockedError(
      formatAccountLockedMessage(remainingMinutes),
      15
    );
    throw error;
  }

  const isPasswordValid = await passwordHasher.compare(password, user.password);
  if (!isPasswordValid) {
    // Increment failed login attempts
    const previousFailedAttempts = isExpiredLockout ? 0 : (user.failedLoginAttempts || 0);
    const newFailedAttempts = previousFailedAttempts + 1;
    const updates = {
      failedLoginAttempts: newFailedAttempts,
      ...(isExpiredLockout ? { lockedUntil: null } : {}),
    };

    // Lock the account if threshold reached
    if (newFailedAttempts >= LOCKOUT_THRESHOLD) {
      const lockUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
      updates.lockedUntil = lockUntil;
      logSecurity('auth.login.account_locked_threshold', {
        userId: user.id,
        email: user.email,
        failedAttempts: newFailedAttempts,
        lockedUntil: lockUntil,
      });
      domainEventBus.emit(EVENT_TYPES.AUTH_ACCOUNT_LOCKED, {
        userId: user.id,
        failedAttempts: newFailedAttempts,
        lockedUntil: lockUntil,
      });
    } else {
      logSecurity('auth.login.failed_attempt', {
        userId: user.id,
        email: user.email,
        failedAttempts: newFailedAttempts,
      });
      domainEventBus.emit(EVENT_TYPES.AUTH_LOGIN_FAILED, {
        userId: user.id,
        failedAttempts: newFailedAttempts,
      });
    }

    await userRepository.update(user.id, updates);

    // Apply progressive login delay
    const delayMs = calculateLoginDelay(newFailedAttempts);
    if (delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }

    throw new AuthenticationError(INVALID_LOGIN_MESSAGE);
  }

  if (!isAdministrativeLoginRole(user.role)) {
    throw new AuthenticationError(INVALID_LOGIN_MESSAGE);
  }

  if (user.isActive === false) {
    throw new AuthenticationError(INACTIVE_ACCOUNT_MESSAGE);
  }

  // Successful login - reset failed attempts and clear lockout
  if (user.failedLoginAttempts > 0 || user.lockedUntil) {
    await userRepository.update(user.id, {
      failedLoginAttempts: 0,
      lockedUntil: null,
    });
  }

  requireAdministrativeLoginRole(user.role);
  const sanitizedUser = sanitizeUser(user);

  // Prefer token pairs with refresh-token persistence; test adapters may expose sign only.
  let accessToken, refreshToken;
  if (tokenService.generateTokenPair) {
    const tokens = tokenService.generateTokenPair(user.id, user.role, {
      name: user.name,
      ...(sanitizedUser.associateId !== undefined ? { associateId: sanitizedUser.associateId } : {}),
    });
    accessToken = tokens.accessToken;
    refreshToken = tokens.refreshToken;
  } else {
    accessToken = tokenService.sign(buildTokenPayload(user));
    refreshToken = null;
  }

  // Store refresh token if repository is available
  if (refreshTokenRepository && refreshToken) {
    const tokenHash = require('@/modules/auth/infrastructure/repositories').hashRefreshToken(refreshToken);
    const expiresAt = require('@/modules/shared/auth/tokenService').calculateRefreshTokenExpiry();
    await refreshTokenRepository.create({
      tokenHash,
      userId: user.id,
      expiresAt,
    });
  }

  // Audit logging for successful login
  if (auditService) {
    await auditService.log({
      actor: { id: user.id, name: user.name, role: user.role },
      action: 'LOGIN',
      module: 'AUTH',
      entityId: String(user.id),
      entityType: 'User',
      metadata: {
        email: user.email,
        loginIdentifier: identifier,
        loginMethod: username && !email ? 'username' : 'email',
      },
      req,
    });
  }

  domainEventBus.emit(EVENT_TYPES.AUTH_LOGIN_SUCCESS, {
    userId: user.id,
    loginMethod: username && !email ? 'username' : 'email',
  });

  return {
    user: sanitizedUser,
    accessToken,
    refreshToken,
    expiresIn: 900, // 15 minutes in seconds
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
  requireAdministrativeLoginRole(user.role);

  return sanitizeUser(user);
};

/**
 * Create the profile update use case for administrative users.
 * @param {{ userRepository: object }} dependencies
 * @returns {Function}
 */
const createUpdateProfile = ({ userRepository }) => async (userId, { name, email }) => {
  const user = await userRepository.findById(userId);
  if (!user) {
    throw new NotFoundError('User');
  }
  requireAdministrativeLoginRole(user.role);

  if (email && email !== user.email) {
    const existingUser = await userRepository.findByEmail(email);
    if (existingUser && existingUser.id !== userId) {
      throw new ConflictError(DUPLICATE_USER_EMAIL_MESSAGE);
    }
  }

  const updatedUser = await userRepository.update(userId, {
    name: name || user.name,
    email: email || user.email,
  });

  return sanitizeUser(updatedUser);
};

/**
 * Create the password change use case for authenticated users.
 * @param {{ userRepository: object, passwordHasher: object, auditService?: object }} dependencies
 * @returns {Function}
 */
const createChangePassword = ({ userRepository, passwordHasher, auditService }) => async (userId, {
  currentPassword,
  nextPassword,
}, { req } = {}) => {
  const user = await userRepository.findById(userId);
  if (!user) {
    throw new NotFoundError('User');
  }
  requireAdministrativeLoginRole(user.role);

  if (!currentPassword || !nextPassword) {
    throw new ValidationError(CHANGE_PASSWORD_REQUIRED_MESSAGE);
  }

  const passwordValidation = validatePasswordStrength(nextPassword);
  if (!passwordValidation.valid) {
    const error = new ValidationError(PASSWORD_REQUIREMENTS_MESSAGE);
    error.errors = passwordValidation.errors.map(msg => ({ field: 'nextPassword', message: msg }));
    throw error;
  }

  const isCurrentPasswordValid = await passwordHasher.compare(currentPassword, user.password);
  if (!isCurrentPasswordValid) {
    throw new AuthenticationError(CURRENT_PASSWORD_INCORRECT_MESSAGE);
  }

  const isSamePassword = await passwordHasher.compare(nextPassword, user.password);
  if (isSamePassword) {
    throw new ValidationError(NEXT_PASSWORD_DIFFERENT_MESSAGE);
  }

  const hashedPassword = await passwordHasher.hash(nextPassword);
  await userRepository.update(userId, { password: hashedPassword });

  // Audit logging for password change
  if (auditService) {
    await auditService.log({
      actor: { id: user.id, name: user.name, role: user.role },
      action: 'UPDATE',
      module: 'AUTH',
      entityId: String(user.id),
      entityType: 'User',
      previousData: { passwordChanged: false },
      newData: { passwordChanged: true },
      req,
    });
  }

  domainEventBus.emit(EVENT_TYPES.AUTH_PASSWORD_CHANGED, { userId: user.id });

  return { success: true };
};

/**
 * Create the refresh token use case that rotates refresh tokens.
 * On successful refresh, the old token is revoked and a new token pair is issued.
 * @param {{ tokenService: object, refreshTokenRepository: object, userRepository: object }} dependencies
 * @returns {Function}
 */
const createRefreshToken = ({ tokenService, refreshTokenRepository, userRepository }) => async ({ refreshToken }) => {
  // Verify the incoming refresh token
  const { userId } = await tokenService.verifyRefreshToken(refreshToken);

  // Revoke the old refresh token (rotation)
  const tokenHash = require('@/modules/auth/infrastructure/repositories').hashRefreshToken(refreshToken);
  await refreshTokenRepository.revoke(tokenHash);

  // Get the user to include roles in the new access token
  const user = await userRepository.findById(userId);
  if (!user) {
    throw new NotFoundError('User');
  }
  const normalizedRole = requireAdministrativeLoginRole(user.role);

  // Generate new token pair
  const sanitizedUser = sanitizeUser(user);
  const { accessToken, refreshToken: newRefreshToken } = tokenService.generateTokenPair(userId, normalizedRole, {
    name: user.name,
    ...(sanitizedUser.associateId !== undefined ? { associateId: sanitizedUser.associateId } : {}),
  });

  // Hash and store the new refresh token
  const newTokenHash = require('@/modules/auth/infrastructure/repositories').hashRefreshToken(newRefreshToken);
  const expiresAt = require('@/modules/shared/auth/tokenService').calculateRefreshTokenExpiry();
  
  await refreshTokenRepository.create({
    tokenHash: newTokenHash,
    userId,
    expiresAt,
  });

  return {
    accessToken,
    refreshToken: newRefreshToken,
    expiresIn: 900, // 15 minutes in seconds
  };
};

/**
 * Create the revoke refresh token use case.
 * Revokes a specific refresh token by its hash.
 * @param {{ refreshTokenRepository: object }} dependencies
 * @returns {Function}
 */
const createRevokeRefreshToken = ({ refreshTokenRepository }) => async ({ refreshToken }) => {
  const tokenHash = require('@/modules/auth/infrastructure/repositories').hashRefreshToken(refreshToken);
  const revoked = await refreshTokenRepository.revoke(tokenHash);
  
  if (!revoked) {
    throw new NotFoundError('Refresh token');
  }

  return { success: true };
};

/**
 * Create the registration use case that creates an admin or employee with explicit or default permissions.
 * Requires admin access.
 * @param {{ userRepository: object, passwordHasher: object, tokenService: object, userPermissionRepository: object, rolePermissionRepository: object, permissionRepository: object, auditService?: object }} dependencies
 * @returns {Function}
 */
const createRegisterWithPermissions = ({
  userRepository,
  passwordHasher,
  tokenService,
  userPermissionRepository,
  rolePermissionRepository,
  permissionRepository,
  auditService,
}) => async ({ actor, payload }) => {
  const { name, email, password, role, permissions: explicitPermissions } = payload;

  // Validate actor has PERMISSIONS_ASSIGN permission
  if (!actor || actor.role !== 'admin') {
    const { AuthorizationError } = require('@/utils/errorHandler');
    throw new AuthorizationError(PERMISSIONS_ASSIGN_REQUIRED_MESSAGE);
  }

  const normalizedRole = requireAdministrativeLoginRole(role);

  // Check for email conflicts
  const existingUser = await userRepository.findByEmail(email);
  if (existingUser) {
    throw new ConflictError(DUPLICATE_USER_EMAIL_MESSAGE);
  }

  // Validate password
  const passwordValidation = validatePasswordStrength(password);
  if (!passwordValidation.valid) {
    const error = new ValidationError(PASSWORD_REQUIREMENTS_MESSAGE);
    error.errors = passwordValidation.errors.map(msg => ({ field: 'password', message: msg }));
    throw error;
  }

  // Determine permissions to assign
  let permissionsToAssign = [];
  if (explicitPermissions && Array.isArray(explicitPermissions) && explicitPermissions.length > 0) {
    // Use explicitly provided permissions - validate they exist
    const allPermissions = await permissionRepository.findAll();
    const validPermissionNames = new Set(allPermissions.map(p => p.name));
    
    const invalidPerms = explicitPermissions.filter(p => !validPermissionNames.has(p));
    if (invalidPerms.length > 0) {
      const error = new ValidationError('Permisos inválidos');
      error.errors = [{ field: 'permissions', message: 'Selecciona permisos válidos para el usuario.' }];
      throw error;
    }
    
    permissionsToAssign = explicitPermissions;
  } else {
    // Derive default permissions from role
    const rolePermissions = await rolePermissionRepository.findByRole(normalizedRole);
    permissionsToAssign = rolePermissions.map(rp => rp.Permission?.name).filter(Boolean);
  }

  // Create user
  const hashedPassword = await passwordHasher.hash(password);
  const user = await userRepository.create({ 
    name, 
    email, 
    password: hashedPassword, 
    role: normalizedRole 
  });

  try {
    // Grant permissions in batch
    if (permissionsToAssign.length > 0) {
      const allPermissions = await permissionRepository.findAll();
      const permissionNameToId = new Map(allPermissions.map(p => [p.name, p.id]));
      
      const permissionIds = permissionsToAssign
        .map(name => permissionNameToId.get(name))
        .filter(id => id !== undefined);

      if (permissionIds.length > 0) {
        await userPermissionRepository.grantBatch({
          userId: user.id,
          permissionIds,
          grantedBy: actor.id,
        });
      }
    }

    // Audit logging
    if (auditService) {
      await auditService.log({
        actor,
        action: 'CREATE',
        module: 'AUTH',
        entityId: String(user.id),
        entityType: 'User',
        newData: { email, role: normalizedRole, permissions: permissionsToAssign },
        metadata: { name },
        req: payload?.req,
      });
    }

    const sanitizedUser = sanitizeUser(user);
    return {
      user: sanitizedUser,
      permissions: permissionsToAssign,
    };
  } catch (error) {
    // Rollback user creation if anything fails
    await userRepository.remove(user.id);
    throw error;
  }
};

/**
 * Create the revoke all user tokens use case.
 * Revokes all refresh tokens for a specific user (used on logout).
 * @param {{ refreshTokenRepository: object, auditService?: object }} dependencies
 * @returns {Function}
 */
const createRevokeAllUserTokens = ({ refreshTokenRepository, auditService }) => async (userId, { req } = {}) => {
  // Get user info before revoking tokens for audit logging
  const user = req?.user || (userId ? await require('@/modules/users/infrastructure/repositories').userRepository.findById(userId) : null);

  const revokedCount = await refreshTokenRepository.revokeAllForUser(userId);

  // Audit logging for logout (revoke all tokens)
  if (auditService && user) {
    await auditService.log({
      actor: { id: user.id, name: user.name, role: user.role },
      action: 'LOGOUT',
      module: 'AUTH',
      entityId: String(user.id),
      entityType: 'User',
      metadata: { tokensRevoked: revokedCount },
      req,
    });
  }

  domainEventBus.emit(EVENT_TYPES.AUTH_LOGOUT, { userId, tokensRevoked: revokedCount });

  return { revokedCount };
};

module.exports = {
  sanitizeUser,
  createRegisterUser,
  createLoginUser,
  createGetProfile,
  createUpdateProfile,
  createChangePassword,
  createRefreshToken,
  createRevokeRefreshToken,
  createRevokeAllUserTokens,
  createRegisterWithPermissions,
};
