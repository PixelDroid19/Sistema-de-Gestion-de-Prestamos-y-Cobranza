const { NotFoundError, AuthorizationError, ValidationError } = require('@/utils/errorHandler');
const { PERMISSION_MODULES } = require('@/models/Permission');
const { domainEventBus, EVENT_TYPES } = require('@/modules/shared/events');
const { validateIntegerId } = require('@/modules/shared/validators');

const INVALID_PERMISSION_FILTER_MESSAGE = 'Filtro de permisos inválido.';
const OPERATOR_SESSION_REQUIRED_MESSAGE = 'No se pudo identificar la sesión del operador.';
const PERMISSION_REQUIRED_MESSAGE = 'El permiso es obligatorio.';
const PERMISSION_LIST_REQUIRED_MESSAGE = 'Debes seleccionar al menos un permiso.';
const PERMISSION_LIST_ENTRY_MESSAGE = 'Cada permiso debe indicarse con un nombre válido.';

const INTEGER_FIELD_LABELS = {
  permissionId: 'El permiso',
  targetUserId: 'El usuario',
};

const normalizeId = (value, fieldName) => {
  const label = INTEGER_FIELD_LABELS[fieldName] ?? 'El identificador';
  if (value === undefined || value === null || value === '') {
    throw new ValidationError(`${label} es obligatorio.`);
  }

  if (!validateIntegerId(value)) {
    throw new ValidationError(`${label} debe ser un entero positivo.`);
  }

  return Number(String(value).trim());
};

const normalizePermissionName = (value) => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ValidationError(PERMISSION_REQUIRED_MESSAGE);
  }
  return value.trim().toUpperCase();
};

const sanitizePermission = (permission) => {
  if (!permission) return null;
  return {
    id: permission.id,
    name: permission.name,
    module: permission.module,
    description: permission.description ?? null,
  };
};

const serializePermissionAssignment = (assignment, permission, source = 'direct') => ({
  id: assignment?.id ?? null,
  userId: assignment?.userId ?? null,
  grantedBy: assignment?.grantedBy ?? null,
  createdAt: assignment?.createdAt ?? null,
  source,
  permissionId: permission?.id ?? assignment?.permissionId ?? null,
  permission: permission?.name ?? null,
  module: permission?.module ?? null,
  permissionData: sanitizePermission(permission) ?? null,
  permissionName: permission?.name ?? null,
});

const mapByModule = (permissions) => {
  const base = PERMISSION_MODULES.reduce((acc, moduleName) => {
    acc[moduleName] = [];
    return acc;
  }, {});

  for (const permission of permissions) {
    if (!permission?.module) continue;
    if (!base[permission.module]) {
      base[permission.module] = [];
    }
    base[permission.module].push(permission);
  }

  return base;
};

const resolvePermission = async ({ permissionRepository, permissionId, permissionName }) => {
  if (permissionId !== undefined && permissionId !== null && permissionId !== '') {
    const normalizedPermissionId = normalizeId(permissionId, 'permissionId');
    const permission = await permissionRepository.findById(normalizedPermissionId);
    if (!permission) {
      throw new NotFoundError('Permission');
    }
    return permission;
  }

  const normalizedPermissionName = normalizePermissionName(permissionName);
  const permission = await permissionRepository.findByName(normalizedPermissionName);
  if (!permission) {
    throw new NotFoundError('Permission');
  }

  return permission;
};

const ensureAdmin = (actor) => {
  if (!actor || !actor.id) {
    throw new ValidationError(OPERATOR_SESSION_REQUIRED_MESSAGE);
  }

  if (actor.role !== 'admin') {
    throw new AuthorizationError('Solo un administrador puede modificar permisos.');
  }
};

const ensureAssignableUser = (user) => {
  if (user?.role !== 'employee') {
    throw new AuthorizationError('Los permisos solo pueden asignarse a cuentas de empleados.');
  }
};

const createListPermissions = ({ permissionRepository }) => async () => {
  const rawPermissions = await permissionRepository.findAll();
  const permissions = rawPermissions.map(sanitizePermission).filter(Boolean);

  return {
    permissions,
    permissionsByModule: mapByModule(permissions),
    total: permissions.length,
  };
};

const createGetPermissionsByModule = ({ permissionRepository }) => async ({ module }) => {
  if (!module) {
    throw new ValidationError('El módulo de permisos es obligatorio.');
  }

  const normalizedModule = String(module).toUpperCase();
  if (!PERMISSION_MODULES.includes(normalizedModule)) {
    throw new ValidationError(INVALID_PERMISSION_FILTER_MESSAGE);
  }

  const permissions = (await permissionRepository.findByModule(normalizedModule)).map(sanitizePermission).filter(Boolean);
  return {
    module: normalizedModule,
    permissions,
    total: permissions.length,
  };
};

const createGetUserPermissions = ({ userPermissionRepository, rolePermissionRepository, userRepository }) => async ({ actor, targetUserId }) => {
  if (!actor || !actor.id) {
    throw new ValidationError(OPERATOR_SESSION_REQUIRED_MESSAGE);
  }

  const normalizedTargetUserId = normalizeId(targetUserId, 'targetUserId');
  const isAdmin = actor.role === 'admin';
  const isSelf = actor.id === normalizedTargetUserId;

  if (!isAdmin && !isSelf) {
    throw new AuthorizationError('Solo un administrador o el propio usuario puede consultar estos permisos.');
  }

  const user = await userRepository.findById(normalizedTargetUserId);
  if (!user) {
    throw new NotFoundError('User');
  }

  const [directAssignments, roleAssignments] = await Promise.all([
    userPermissionRepository.findByUser(normalizedTargetUserId),
    rolePermissionRepository.findByRole(user.role),
  ]);

  const directPermissions = directAssignments
    .map((assignment) => serializePermissionAssignment(assignment, assignment.Permission, 'direct'))
    .filter((item) => Boolean(item.permissionName));

  const rolePermissions = roleAssignments
    .map((assignment) => serializePermissionAssignment(null, assignment.Permission, 'role'))
    .filter((item) => Boolean(item.permissionName));

  const resolvedByName = new Map();
  for (const permission of rolePermissions) {
    resolvedByName.set(permission.permissionName, permission);
  }
  for (const permission of directPermissions) {
    resolvedByName.set(permission.permissionName, permission);
  }

  const permissions = Array.from(resolvedByName.values());
  const permissionNames = permissions.map((permission) => permission.permissionName);

  return {
    userId: normalizedTargetUserId,
    role: user.role,
    permissions,
    directPermissions,
    rolePermissions,
    allPermissions: permissionNames,
    permissionNames,
    total: permissions.length,
  };
};

const createGetMyPermissions = ({ userPermissionRepository, rolePermissionRepository, userRepository }) => async ({ actor }) => {
  if (!actor || !actor.id) {
    throw new ValidationError(OPERATOR_SESSION_REQUIRED_MESSAGE);
  }

  const result = await createGetUserPermissions({ userPermissionRepository, rolePermissionRepository, userRepository })({
    actor,
    targetUserId: actor.id,
  });

  return {
    ...result,
    permissions: result.permissions.map((entry) => ({
      ...entry,
      name: entry.permissionName,
    })),
  };
};

const createGrantPermission = ({ permissionRepository, userPermissionRepository, userRepository }) => async ({ actor, targetUserId, permissionId, permission }) => {
  ensureAdmin(actor);

  const normalizedTargetUserId = normalizeId(targetUserId, 'targetUserId');
  const user = await userRepository.findById(normalizedTargetUserId);
  if (!user) {
    throw new NotFoundError('User');
  }
  ensureAssignableUser(user);

  const resolvedPermission = await resolvePermission({
    permissionRepository,
    permissionId,
    permissionName: permission,
  });

  const createdAssignment = await userPermissionRepository.grant({
    userId: normalizedTargetUserId,
    permissionId: resolvedPermission.id,
    grantedBy: actor.id,
  });

  const assignment = serializePermissionAssignment(createdAssignment, resolvedPermission, 'direct');

  domainEventBus.emit(EVENT_TYPES.PERMISSION_GRANTED, {
    userId: normalizedTargetUserId,
    permissionName: assignment.permissionName,
    grantedBy: actor.id,
  });

  return {
    userId: normalizedTargetUserId,
    permissionId: assignment.permissionId,
    permissionName: assignment.permissionName,
    permission: assignment.permission,
    permissionData: assignment.permissionData,
    assignment,
    userPermission: {
      id: assignment.id,
      userId: assignment.userId,
      permissionId: assignment.permissionId,
      grantedBy: assignment.grantedBy,
      createdAt: assignment.createdAt,
    },
  };
};

const createGrantBatchPermissions = ({ permissionRepository, userPermissionRepository, userRepository }) => async ({ actor, targetUserId, permissionIds, permissions }) => {
  ensureAdmin(actor);

  const normalizedTargetUserId = normalizeId(targetUserId, 'targetUserId');
  const user = await userRepository.findById(normalizedTargetUserId);
  if (!user) {
    throw new NotFoundError('User');
  }
  ensureAssignableUser(user);

  let requests = [];

  if (Array.isArray(permissionIds) && permissionIds.length > 0) {
    requests = permissionIds.map((value) => ({ permissionId: value }));
  } else if (Array.isArray(permissions) && permissions.length > 0) {
    requests = permissions.map((value) => {
      if (value && typeof value === 'object') {
        return {
          permissionId: value.permissionId,
          permission: value.permission,
        };
      }

      if (typeof value === 'string') {
        return { permission: value };
      }

      return { permissionId: value };
    });
  }

  if (requests.length === 0) {
    throw new ValidationError(PERMISSION_LIST_REQUIRED_MESSAGE);
  }

  const granted = [];
  const failed = [];

  for (const request of requests) {
    try {
      const resolvedPermission = await resolvePermission({
        permissionRepository,
        permissionId: request.permissionId,
        permissionName: request.permission,
      });

      const createdAssignment = await userPermissionRepository.grant({
        userId: normalizedTargetUserId,
        permissionId: resolvedPermission.id,
        grantedBy: actor.id,
      });

      granted.push(serializePermissionAssignment(createdAssignment, resolvedPermission, 'direct'));
    } catch (error) {
      failed.push({
        permissionId: request.permissionId ?? null,
        permission: request.permission ?? null,
        reason: error.message,
      });
    }
  }

  return {
    userId: normalizedTargetUserId,
    granted,
    failed,
    grantedCount: granted.length,
    failedCount: failed.length,
  };
};

const createRevokePermission = ({ permissionRepository, userPermissionRepository, userRepository }) => async ({ actor, targetUserId, permissionId, permission }) => {
  ensureAdmin(actor);

  const normalizedTargetUserId = normalizeId(targetUserId, 'targetUserId');
  const user = await userRepository.findById(normalizedTargetUserId);
  if (!user) {
    throw new NotFoundError('User');
  }

  const resolvedPermission = await resolvePermission({
    permissionRepository,
    permissionId,
    permissionName: permission,
  });

  const revoked = await userPermissionRepository.revoke(normalizedTargetUserId, resolvedPermission.id);

  domainEventBus.emit(EVENT_TYPES.PERMISSION_REVOKED, {
    userId: normalizedTargetUserId,
    permissionName: resolvedPermission.name,
    revokedBy: actor.id,
  });

  return {
    success: revoked,
    revoked,
    userId: normalizedTargetUserId,
    permissionId: resolvedPermission.id,
    permissionName: resolvedPermission.name,
    permission: resolvedPermission.name,
    permissionData: sanitizePermission(resolvedPermission),
  };
};

const createCheckPermission = ({ permissionRepository, userPermissionRepository, rolePermissionRepository, userRepository }) => async ({ actor, permissionName, permission }) => {
  if (!actor || !actor.id) {
    throw new ValidationError(OPERATOR_SESSION_REQUIRED_MESSAGE);
  }

  const normalizedPermissionName = normalizePermissionName(permissionName ?? permission);

  const resolvedPermissions = await createGetUserPermissions({
    userPermissionRepository,
    rolePermissionRepository,
    userRepository,
  })({ actor, targetUserId: actor.id });

  const allowedPermission = resolvedPermissions.permissions.find((entry) => entry.permissionName === normalizedPermissionName);

  if (!allowedPermission) {
    const existingPermission = await permissionRepository.findByName(normalizedPermissionName);
    if (!existingPermission) {
      return {
        allowed: false,
        source: null,
        permissionName: normalizedPermissionName,
      };
    }

    return {
      allowed: false,
      source: null,
      permissionName: normalizedPermissionName,
      permissionId: existingPermission.id,
    };
  }

  return {
    allowed: true,
    source: allowedPermission.source,
    permissionName: allowedPermission.permissionName,
    permissionId: allowedPermission.permissionId,
  };
};

const createCheckMultiplePermissions = ({ permissionRepository, userPermissionRepository, rolePermissionRepository, userRepository }) => async ({ actor, permissionNames, permissions }) => {
  if (!actor || !actor.id) {
    throw new ValidationError(OPERATOR_SESSION_REQUIRED_MESSAGE);
  }

  const requested = Array.isArray(permissionNames) && permissionNames.length > 0
    ? permissionNames
    : permissions;

  if (!Array.isArray(requested) || requested.length === 0) {
    throw new ValidationError(PERMISSION_LIST_REQUIRED_MESSAGE);
  }

  const normalizedNames = requested.map((entry) => {
    if (typeof entry === 'string') {
      return normalizePermissionName(entry);
    }
    if (entry && typeof entry === 'object') {
      return normalizePermissionName(entry.permissionName ?? entry.permission);
    }
    throw new ValidationError(PERMISSION_LIST_ENTRY_MESSAGE);
  });

  const uniqueNames = Array.from(new Set(normalizedNames));
  const checks = await Promise.all(
    uniqueNames.map((name) => createCheckPermission({
      permissionRepository,
      userPermissionRepository,
      rolePermissionRepository,
      userRepository,
    })({ actor, permissionName: name }))
  );

  const byName = new Map(checks.map((entry) => [entry.permissionName, entry]));
  const results = normalizedNames.map((name) => ({
    name,
    ...byName.get(name),
  }));

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
