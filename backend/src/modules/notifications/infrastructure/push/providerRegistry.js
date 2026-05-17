const { createWebPushProvider } = require('./providers/webPushProvider');

const createPushProviderRegistry = ({
  providers = [createWebPushProvider()],
} = {}) => {
  const registry = new Map();

  providers
    .filter(Boolean)
    .forEach((provider) => {
      registry.set(provider.key, provider);
    });

  return {
    resolve(subscription) {
      if (!subscription?.providerKey) {
        return null;
      }

      return registry.get(subscription.providerKey) || null;
    },
  };
};

module.exports = {
  createPushProviderRegistry,
};
