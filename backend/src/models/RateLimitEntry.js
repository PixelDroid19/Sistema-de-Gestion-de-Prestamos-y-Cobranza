const { DataTypes } = require('sequelize');
const sequelize = require('./database');

/**
 * Rate limit tracking table for PostgreSQL-backed sliding window rate limiter.
 * Stores individual request timestamps for each IP/key combination.
 * 
 * Table is periodically cleaned up to prevent bloat (entries older than 2x windowMs are deleted).
 */
const RateLimitEntry = sequelize.define('RateLimitEntry', {
  id: { 
    type: DataTypes.INTEGER, 
    autoIncrement: true, 
    primaryKey: true 
  },
  keyPrefix: { 
    type: DataTypes.STRING(50), 
    allowNull: false,
    comment: 'Rate limiter key prefix (e.g., global, auth, payment, workbench)',
  },
  identifier: { 
    type: DataTypes.STRING(255), 
    allowNull: false,
    comment: 'Full identifier key (e.g., ip:192.168.1.1)',
  },
  createdAt: { 
    type: DataTypes.DATE, 
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'created_at',
  },
}, {
  tableName: 'rate_limit_entries',
  timestamps: false, // We manage created_at manually
  indexes: [
    // Composite index for efficient window queries
    {
      fields: ['keyPrefix', 'identifier', 'created_at'],
    },
    // Index for cleanup operations
    {
      fields: ['keyPrefix', 'created_at'],
    },
  ],
});

module.exports = RateLimitEntry;
