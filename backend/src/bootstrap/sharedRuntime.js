const { createModule } = require('@/modules/shared/contracts');
const { createAuthContext } = require('@/modules/shared/auth');
const { notificationService } = require('@/modules/notifications/application/notificationService');
const { createPermissionServiceForMiddleware } = require('@/modules/permissions/infrastructure/permissionServiceInfrastructure');

const createPortsRegistry = (seed = {}) => {
  const registry = new Map(Object.entries(seed));

  return {
    register(name, ports) {
      if (!name) {
        throw new Error('Shared runtime port registration requires a module name');
      }

      if (!ports || typeof ports !== 'object') {
        throw new Error(`Shared runtime ports for "${name}" must be an object`);
      }

      registry.set(name, ports);
      return ports;
    },
    get(name) {
      return registry.get(name);
    },
    entries() {
      return Array.from(registry.entries());
    },
  };
};

/**
 * Build backend-wide shared runtime dependencies exactly once.
 * @param {{ authContext?: { tokenService: object, authMiddleware: Function }, notificationService?: object }} [options]
 * @returns {{ authContext: object, tokenService: object, authMiddleware: Function, contracts: object, notificationService: object, registerModulePorts: Function, getModulePorts: Function, listModulePorts: Function }}
 */
const createSharedRuntime = ({
  authContext = createAuthContext({ permissionService: createPermissionServiceForMiddleware() }),
  notificationService: notifications = notificationService,
} = {}) => {
  const portsRegistry = createPortsRegistry();

  const runtime = {
    authContext,
    tokenService: authContext.tokenService,
    authMiddleware: authContext.authMiddleware,
    contracts: {
      createModule,
    },
    notificationService: notifications,
    registerModulePorts(name, ports) {
      return portsRegistry.register(name, ports);
    },
    getModulePorts(name) {
      return portsRegistry.get(name);
    },
    listModulePorts() {
      return portsRegistry.entries();
    },
  };

  runtime.registerModulePorts('notifications', {
    notificationService: runtime.notificationService,
  });

  return runtime;
};

module.exports = {
  createSharedRuntime,
};
