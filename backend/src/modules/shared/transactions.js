/**
 * Shared transaction utilities for Sequelize operations.
 *
 * Provides a consistent wrapper around `sequelize.transaction()` to reduce
 * boilerplate and centralize error-handling / logging concerns.
 *
 * @module shared/transactions
 */

const sequelize = require('@/models/database');

/**
 * Execute a function within a managed Sequelize transaction.
 *
 * If the callback succeeds, the transaction is committed automatically.
 * If it throws, the transaction is rolled back and the error is re-thrown.
 *
 * @template T
 * @param {(transaction: import('sequelize').Transaction) => Promise<T>} callback
 * @param {object} [options] - Sequelize transaction options (isolationLevel, type, etc.)
 * @returns {Promise<T>}
 */
const withTransaction = async (callback, options = {}) => {
  return sequelize.transaction(options, callback);
};

module.exports = {
  withTransaction,
};
