const bcrypt = require('bcryptjs');
const User = require('../../../models/User');
const Customer = require('../../../models/Customer');
const Agent = require('../../../models/Agent');
const Associate = require('../../../models/Associate');

/**
 * Persistence ports for user identities and role-specific profile records.
 */
const userRepository = {
  findByEmail(email) {
    return User.findOne({ where: { email } });
  },
  findById(id) {
    return User.findByPk(id);
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
  findAgentUserByEmail(email) {
    return User.findOne({ where: { email, role: 'agent' } });
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

/**
 * Persistence port for agent profile records linked to user identities.
 */
const agentProfileRepository = {
  create(payload) {
    return Agent.create(payload);
  },
  async update(id, payload) {
    const agent = await Agent.findByPk(id);
    if (!agent) {
      return null;
    }

    await agent.update(payload);
    return agent;
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

module.exports = {
  userRepository,
  customerProfileRepository,
  agentProfileRepository,
  associateProfileRepository,
  passwordHasher,
};
