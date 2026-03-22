const User = require('../../../models/User');
const { paginateModel } = require('../../shared/pagination');

const userRepository = {
  findAll() {
    return User.findAll({
      order: [['createdAt', 'DESC']],
    });
  },

  findPage({ page, pageSize }) {
    return paginateModel({
      model: User,
      page,
      pageSize,
      order: [['createdAt', 'DESC']],
    });
  },

  findById(userId) {
    return User.findByPk(userId);
  },

  findByEmail(email) {
    return User.findOne({ where: { email } });
  },

  create(data) {
    return User.create(data);
  },

  async update(userId, data) {
    const user = await User.findByPk(userId);
    if (!user) {
      return null;
    }

    await user.update(data);
    return user;
  },

  destroy(userId) {
    return User.destroy({ where: { id: userId } });
  },
};

module.exports = {
  userRepository,
};
