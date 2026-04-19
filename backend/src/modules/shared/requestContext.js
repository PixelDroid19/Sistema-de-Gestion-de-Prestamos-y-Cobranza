const { AsyncLocalStorage } = require('node:async_hooks');

const requestContextStorage = new AsyncLocalStorage();

const runWithRequestContext = (context, callback) => requestContextStorage.run(context, callback);

const getRequestContext = () => requestContextStorage.getStore() || null;

const getCurrentRequest = () => getRequestContext()?.req || null;

module.exports = {
  runWithRequestContext,
  getRequestContext,
  getCurrentRequest,
};
