const { notificationService } = require('./application/notificationService');

/**
 * Expose notification capabilities that other modules may consume.
 * @param {{ sharedRuntime?: { getModulePorts?: Function, notificationService?: object } }} [options]
 * @returns {{ notificationService: object }}
 */
const createNotificationsPublicPorts = ({ sharedRuntime } = {}) => {
  const runtimePorts = sharedRuntime?.getModulePorts?.('notifications');

  if (runtimePorts) {
    return runtimePorts;
  }

  return {
    notificationService: sharedRuntime?.notificationService || notificationService,
  };
};

module.exports = {
  createNotificationsPublicPorts,
};
