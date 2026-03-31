const { DataTypes } = require('sequelize');

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (t) => {
      await queryInterface.createTable(
        'refresh_tokens',
        {
          id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
            allowNull: false,
          },
          token_hash: {
            type: DataTypes.STRING(64),
            allowNull: false,
            unique: true,
          },
          user_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
              model: 'Users',
              key: 'id',
            },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
          },
          expires_at: {
            type: DataTypes.DATE,
            allowNull: false,
          },
          revoked_at: {
            type: DataTypes.DATE,
            allowNull: true,
          },
          createdAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
          },
        },
        { transaction: t }
      );

      // Create index on token_hash for fast lookups
      await queryInterface.addIndex('refresh_tokens', ['token_hash'], {
        unique: true,
        transaction: t,
        name: 'refresh_tokens_token_hash_unique',
      });

      // Create index on user_id for finding all user tokens
      await queryInterface.addIndex('refresh_tokens', ['user_id'], {
        transaction: t,
        name: 'refresh_tokens_user_id_index',
      });
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (t) => {
      await queryInterface.dropTable('refresh_tokens', { transaction: t });
    });
  },
};
