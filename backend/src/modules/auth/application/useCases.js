const { ValidationError, NotFoundError, AuthenticationError, AuthorizationError, ConflictError } = require('@/utils/errorHandler');
const { APPLICATION_ROLES, isAdministrativeLoginRole, normalizeApplicationRole } = require('@/modules/shared/roles');

const PRIVILEGED_ROLES = new Set(['admin']);
const EMPLOYEE_ROLE = 'employee';

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
    return { valid: false, errors: ['Password is required'] };
  }

  if (password.length < PASSWORD_MIN_LENGTH) {
    errors.push(`Password must be at least ${PASSWORD_MIN_LENGTH} characters long`);
  }

  if (PASSWORD_COMPLEXITY.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (PASSWORD_COMPLEXITY.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (PASSWORD_COMPLEXITY.requireNumbers && !/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (PASSWORD_COMPLEXITY.requireSpecialChars && !/[!@#$%^&*()_+\-={};'":\\|,.<>/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
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
  const error = new ValidationError('Please correct the following errors');
  error.errors = [
    {
      field: 'role',
      message: 'Public registration is disabled. An administrator must create employee accounts.',
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
  const error = new ValidationError('Please correct the following errors');
  error.errors = [
    {
      field: 'role',
      message: `Role must be one of: ${APPLICATION_ROLES.join(', ')}`,
    },
  ];

  return error;
};

const buildAdministrativeRoleValidationError = () => {
  const error = new ValidationError('Please correct the following errors');
  error.errors = [
    {
      field: 'role',
      message: 'Administrative users must be admin or employee',
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
  const normalizedRole = requireSupportedRole(role, { allowLegacyAliases: false });
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
    throw new AuthorizationError('Privileged account creation requires admin access');
  }

  const existingUser = await userRepository.findByEmail(email);
  if (existingUser) {
    throw new ConflictError('User with this email already exists');
  }

  const passwordValidation = validatePasswordStrength(password);
  if (!passwordValidation.valid) {
    const error = new ValidationError('Password does not meet requirements');
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
  const { AccountLockedError } = require('@/utils/errorHandler');
  const { logSecurity } = require('@/utils/logger');

  const { email, username, identifier, password, req } = normalizeLoginCredentials(credentials);

  const LOCKOUT_THRESHOLD = 5; // Lock after 5 consecutive failed attempts
  const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

  const user = typeof userRepository.findByLoginIdentifier === 'function'
    ? await userRepository.findByLoginIdentifier(identifier)
    : await userRepository.findByEmail(email || username);
  if (!user) {
    // Don't reveal whether identifier exists - generic error message
    throw new AuthenticationError('Please enter correct email/password');
  }

  // Check if account is currently locked
  if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
    const remainingMinutes = Math.ceil((new Date(user.lockedUntil) - new Date()) / 60000);
    logSecurity('auth.login.account_locked', {
      userId: user.id,
      email: user.email,
      lockedUntil: user.lockedUntil,
    });
    const error = new AccountLockedError(
      `Account temporarily locked due to too many failed login attempts. Try again in ${remainingMinutes} minute(s).`,
      15
    );
    throw error;
  }

  const isPasswordValid = await passwordHasher.compare(password, user.password);
  if (!isPasswordValid) {
    // Increment failed login attempts
    const newFailedAttempts = (user.failedLoginAttempts || 0) + 1;
    const updates = { failedLoginAttempts: newFailedAttempts };

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
    } else {
      logSecurity('auth.login.failed_attempt', {
        userId: user.id,
        email: user.email,
        failedAttempts: newFailedAttempts,
      });
    }

    await userRepository.update(user.id, updates);

    // Apply progressive login delay
    const delayMs = calculateLoginDelay(newFailedAttempts);
    if (delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }

    throw new AuthenticationError('Please enter correct email/password');
  }

  if (!isAdministrativeLoginRole(user.role)) {
    throw new AuthenticationError('Please enter correct email/password');
  }

  if (user.isActive === false) {
    throw new AuthenticationError('This account is inactive');
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
      throw new ConflictError('Email already in use');
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
    throw new ValidationError('Current password and next password are required');
  }

  const passwordValidation = validatePasswordStrength(nextPassword);
  if (!passwordValidation.valid) {
    const error = new ValidationError('Password does not meet requirements');
    error.errors = passwordValidation.errors.map(msg => ({ field: 'nextPassword', message: msg }));
    throw error;
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
    throw new AuthorizationError('PERMISSIONS_ASSIGN permission required');
  }

  const normalizedRole = requireAdministrativeLoginRole(role);

  // Check for email conflicts
  const existingUser = await userRepository.findByEmail(email);
  if (existingUser) {
    throw new ConflictError('User with this email already exists');
  }

  // Validate password
  const passwordValidation = validatePasswordStrength(password);
  if (!passwordValidation.valid) {
    const error = new ValidationError('Password does not meet requirements');
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
      const error = new ValidationError('Invalid permissions');
      error.errors = [{ field: 'permissions', message: `Invalid permissions: ${invalidPerms.join(', ')}` }];
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
