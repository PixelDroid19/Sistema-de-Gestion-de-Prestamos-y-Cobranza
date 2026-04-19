const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const sequelize = require('@/models/database');
const User = require('@/models/User');
const Customer = require('@/models/Customer');
const Associate = require('@/models/Associate');
const RefreshToken = require('@/models/RefreshToken');

/**
 * Hash a refresh token using SHA-256.
 * @param {string} token
 * @returns {string}
 */
const hashRefreshToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

/**
 * Persistence ports for user identities and role-specific profile records.
 */
const userRepository = {
  findByEmail(email) {
    return User.findOne({ where: { email } });
  },
  findByName(name) {
    return User.findOne({ where: { name } });
  },
  async findByLoginIdentifier(identifier) {
    if (typeof identifier !== 'string' || !identifier.trim()) {
      return null;
    }

    const normalizedIdentifier = identifier.trim();

    const byEmail = await User.findOne({ where: { email: normalizedIdentifier } });
    if (byEmail) {
      return byEmail;
    }

    return User.findOne({ where: { name: normalizedIdentifier } });
  },
  findById(id) {
    return User.findByPk(id);
  },
  syncPrimaryKeySequenceWithCustomerProfiles() {
    return sequelize.query(`
      SELECT setval(
        pg_get_serial_sequence('"Users"', 'id'),
        GREATEST(
          COALESCE((SELECT MAX(id) FROM "Users"), 0),
          COALESCE((SELECT MAX(id) FROM "Customers"), 0)
        ),
        true
      );
    `);
  },
  create(payload) {
    return User.create(payload);
  },
  async update(id, payload) {
    const user = await User.findByPk(id);
    if (!user) {
      return null;
    }

    await user.update(payload);
    return user;
  },
  remove(id) {
    return User.destroy({ where: { id } });
  },
  findRecoveryAssigneeUserByEmail(email) {
    return User.findOne({ where: { email } });
  },
};

/**
 * Persistence port for customer profile records linked to user identities.
 */
const customerProfileRepository = {
  create(payload) {
    return Customer.create(payload);
  },
  async update(id, payload) {
    const customer = await Customer.findByPk(id);
    if (!customer) {
      return null;
    }

    await customer.update(payload);
    return customer;
  },
};

const associateProfileRepository = {
  create(payload) {
    return Associate.create(payload);
  },
  async update(id, payload) {
    const associate = await Associate.findByPk(id);
    if (!associate) {
      return null;
    }

    await associate.update(payload);
    return associate;
  },
};

/**
 * Password hashing contract used by the auth use cases.
 */
const passwordHasher = {
  hash(password) {
    return bcrypt.hash(password, 12);
  },
  compare(password, hashedPassword) {
    return bcrypt.compare(password, hashedPassword);
  },
};

/**
 * Repository for managing refresh tokens in the database.
 */
const refreshTokenRepository = {
  async create({ tokenHash, userId, expiresAt }) {
    return RefreshToken.create({
      tokenHash,
      userId,
      expiresAt,
      revokedAt: null,
    });
  },

  findByTokenHash(tokenHash) {
    return RefreshToken.findOne({ where: { tokenHash } });
  },

  findByUserId(userId) {
    return RefreshToken.findAll({ where: { userId } });
  },

  async revoke(tokenHash) {
    const token = await RefreshToken.findOne({ where: { tokenHash } });
    if (!token) {
      return null;
    }
    await token.update({ revokedAt: new Date() });
    return token;
  },

  async revokeAllForUser(userId) {
    const [updatedCount] = await RefreshToken.update(
      { revokedAt: new Date() },
      {
        where: {
          userId,
          revokedAt: null,
        },
      }
    );
    return updatedCount;
  },
};

module.exports = {
  userRepository,
  customerProfileRepository,
  associateProfileRepository,
  passwordHasher,
  refreshTokenRepository,
  hashRefreshToken,
};
