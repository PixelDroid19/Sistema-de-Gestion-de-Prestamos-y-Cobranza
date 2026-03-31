const { NotFoundError, AuthorizationError, ValidationError } = require('../../../utils/errorHandler');
const { PERMISSION_MODULES } = require('../../../models/Permission');

const createListPermissions = ({ permissionRepository }) => async () => {
  const permissions = await permissionRepository.findAll();
  const permissionsByModule = PERMISSION_MODULES.reduce((acc, module) => {
    acc[module] = [];
    return acc;
  }, {});

  for (const permission of permissions) {
    if (permissionsByModule[permission.module]) {
      permissionsByModule[permission.module].push(permission);
    }
  }

  return { permissionsByModule };
};

const createGetPermissionsByModule = ({ permissionRepository }) => async ({ module }) => {
  if (!module) {
    throw new ValidationError('module is required');
  }

  const normalizedModule = module.toUpperCase();
  if (!PERMISSION_MODULES.includes(normalizedModule)) {
    throw new ValidationError(`Invalid module. Valid modules: ${PERMISSION_MODULES.join(', ')}`);
  }

  const permissions = await permissionRepository.findByModule(normalizedModule);
  return { module: normalizedModule, permissions };
};

const createGetUserPermissions = ({ permissionRepository, userPermissionRepository, rolePermissionRepository, userRepository }) => async ({ actor, targetUserId }) => {
  if (!actor || !actor.id) {
    throw new ValidationError('actor is required');
  }

  if (!targetUserId) {
    throw new ValidationError('targetUserId is required');
  }

  const isAdmin = actor.role === 'admin';
  const isSelf = actor.id === Number(targetUserId);

  if (!isAdmin && !isSelf) {
    throw new AuthorizationError('Only admin or the user themselves can view permissions');
  }

  const user = await userRepository.findById(targetUserId);
  if (!user) {
    throw new NotFoundError('User');
  }

  const [directPermissions, rolePermissions] = await Promise.all([
    userPermissionRepository.findByUser(targetUserId),
    rolePermissionRepository.findByRole(user.role),
  ]);

  const directPerms = directPermissions.map((up) => up.Permission);
  const rolePerms = rolePermissions.map((rp) => rp.Permission);

  const allPermNames = new Set([
    ...directPerms.map((p) => p?.name).filter(Boolean),
    ...rolePerms.map((p) => p?.name).filter(Boolean),
  ]);

  return {
    userId: Number(targetUserId),
    directPermissions: directPerms,
    rolePermissions: rolePerms,
    allPermissions: Array.from(allPermNames),
  };
};

const createGetMyPermissions = ({ permissionRepository, userPermissionRepository, rolePermissionRepository, userRepository }) => async ({ actor }) => {
  if (!actor || !actor.id) {
    throw new ValidationError('actor is required');
  }

  const user = await userRepository.findById(actor.id);
  if (!user) {
    throw new NotFoundError('User');
  }

  const [directPermissions, rolePermissions] = await Promise.all([
    userPermissionRepository.findByUser(actor.id),
    rolePermissionRepository.findByRole(user.role),
  ]);

  const directPerms = directPermissions.map((up) => ({
    ...up.Permission,
    source: 'direct',
  }));

  const rolePerms = rolePermissions.map((rp) => ({
    ...rp.Permission,
    source: 'role',
  }));

  const permissionMap = new Map();

  for (const perm of directPerms) {
    permissionMap.set(perm.name, perm);
  }

  for (const perm of rolePerms) {
    if (!permissionMap.has(perm.name)) {
      permissionMap.set(perm.name, perm);
    }
  }

  return {
    userId: actor.id,
    permissions: Array.from(permissionMap.values()),
  };
};

const createGrantPermission = ({ permissionRepository, userPermissionRepository, userRepository }) => async ({ actor, targetUserId, permissionId }) => {
  if (!actor || !actor.id) {
    throw new ValidationError('actor is required');
  }

  if (actor.role !== 'admin') {
    throw new AuthorizationError('Only admin can grant permissions');
  }

  if (!targetUserId) {
    throw new ValidationError('targetUserId is required');
  }

  if (!permissionId) {
    throw new ValidationError('permissionId is required');
  }

  const [user, permission] = await Promise.all([
    userRepository.findById(targetUserId),
    permissionRepository.findById(permissionId),
  ]);

  if (!user) {
    throw new NotFoundError('User');
  }

  if (!permission) {
    throw new NotFoundError('Permission');
  }

  const userPermission = await userPermissionRepository.grant({
    userId: targetUserId,
    permissionId,
    grantedBy: actor.id,
  });

  return {
    userPermission: {
      id: userPermission.id,
      userId: userPermission.userId,
      permissionId: userPermission.permissionId,
      grantedBy: userPermission.grantedBy,
      createdAt: userPermission.createdAt,
    },
  };
};

const createGrantBatchPermissions = ({ permissionRepository, userPermissionRepository, userRepository }) => async ({ actor, targetUserId, permissionIds }) => {
  if (!actor || !actor.id) {
    throw new ValidationError('actor is required');
  }

  if (actor.role !== 'admin') {
    throw new AuthorizationError('Only admin can grant permissions');
  }

  if (!targetUserId) {
    throw new ValidationError('targetUserId is required');
  }

  if (!Array.isArray(permissionIds) || permissionIds.length === 0) {
    throw new ValidationError('permissionIds must be a non-empty array');
  }

  const user = await userRepository.findById(targetUserId);
  if (!user) {
    throw new NotFoundError('User');
  }

  const results = await Promise.allSettled(
    permissionIds.map((permissionId) =>
      userPermissionRepository.grant({
        userId: targetUserId,
        permissionId,
        grantedBy: actor.id,
      })
    )
  );

  const granted = [];
  const failed = [];

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const permissionId = permissionIds[i];

    if (result.status === 'fulfilled') {
      granted.push({
        id: result.value.id,
        userId: result.value.userId,
        permissionId: result.value.permissionId,
        grantedBy: result.value.grantedBy,
        createdAt: result.value.createdAt,
      });
    } else {
      failed.push({
        permissionId,
        reason: result.reason?.message || 'Failed to grant permission',
      });
    }
  }

  return { granted, failed };
};

const createRevokePermission = ({ userPermissionRepository }) => async ({ actor, targetUserId, permissionId }) => {
  if (!actor || !actor.id) {
    throw new ValidationError('actor is required');
  }

  if (actor.role !== 'admin') {
    throw new AuthorizationError('Only admin can revoke permissions');
  }

  if (!targetUserId) {
    throw new ValidationError('targetUserId is required');
  }

  if (!permissionId) {
    throw new ValidationError('permissionId is required');
  }

  const success = await userPermissionRepository.revoke(targetUserId, permissionId);
  return { success };
};

const createCheckPermission = ({ permissionRepository, userPermissionRepository, rolePermissionRepository, userRepository }) => async ({ actor, permissionName }) => {
  if (!actor || !actor.id) {
    throw new ValidationError('actor is required');
  }

  if (!permissionName) {
    throw new ValidationError('permissionName is required');
  }

  const permission = await permissionRepository.findByName(permissionName);
  if (!permission) {
    return { allowed: false, source: null };
  }

  const [directPermissions, user] = await Promise.all([
    userPermissionRepository.findByUser(actor.id),
    userRepository.findById(actor.id),
  ]);

  const hasDirect = directPermissions.some(
    (up) => up.Permission && up.Permission.name === permissionName
  );

  if (hasDirect) {
    return { allowed: true, source: 'direct' };
  }

  if (user) {
    const rolePermissions = await rolePermissionRepository.findByRole(user.role);
    const hasRole = rolePermissions.some(
      (rp) => rp.Permission && rp.Permission.name === permissionName
    );

    if (hasRole) {
      return { allowed: true, source: 'role' };
    }
  }

  return { allowed: false, source: null };
};

const createCheckMultiplePermissions = ({ permissionRepository, userPermissionRepository, rolePermissionRepository, userRepository }) => async ({ actor, permissionNames }) => {
  if (!actor || !actor.id) {
    throw new ValidationError('actor is required');
  }

  if (!Array.isArray(permissionNames) || permissionNames.length === 0) {
    throw new ValidationError('permissionNames must be a non-empty array');
  }

  const [directPermissions, user] = await Promise.all([
    userPermissionRepository.findByUser(actor.id),
    userRepository.findById(actor.id),
  ]);

  const directPermNames = new Set(
    directPermissions.map((up) => up.Permission?.name).filter(Boolean)
  );

  let rolePermNames = new Set();
  if (user) {
    const rolePermissions = await rolePermissionRepository.findByRole(user.role);
    rolePermNames = new Set(
      rolePermissions.map((rp) => rp.Permission?.name).filter(Boolean)
    );
  }

  const results = permissionNames.map((name) => {
    if (directPermNames.has(name)) {
      return { name, allowed: true, source: 'direct' };
    }
    if (rolePermNames.has(name)) {
      return { name, allowed: true, source: 'role' };
    }
    return { name, allowed: false, source: null };
  });

  return { permissions: results };
};

module.exports = {
  createListPermissions,
  createGetPermissionsByModule,
  createGetUserPermissions,
  createGetMyPermissions,
  createGrantPermission,
  createGrantBatchPermissions,
  createRevokePermission,
  createCheckPermission,
  createCheckMultiplePermissions,
};
