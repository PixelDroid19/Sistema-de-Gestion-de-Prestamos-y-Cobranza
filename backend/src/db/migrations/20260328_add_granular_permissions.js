const { DataTypes } = require('sequelize');

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (t) => {
      await queryInterface.createTable(
        'Permissions',
        {
          id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
          },
          name: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
          },
          module: {
            type: DataTypes.ENUM('CREDITOS', 'CLIENTES', 'PAGOS', 'SOCIOS', 'REPORTES', 'DASHBOARD', 'USUARIOS', 'PERMISOS', 'AUDITORÍA'),
            allowNull: false,
          },
          description: {
            type: DataTypes.STRING,
            allowNull: true,
          },
          createdAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
          },
          updatedAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
          },
        },
        { transaction: t }
      );

      await queryInterface.createTable(
        'RolePermissions',
        {
          role: {
            type: DataTypes.ENUM('admin', 'customer', 'socio'),
            allowNull: false,
          },
          permissionId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
              model: 'Permissions',
              key: 'id',
            },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
          },
        },
        {
          transaction: t,
          primaryKey: false,
        }
      );

      await queryInterface.addConstraint('RolePermissions', {
        fields: ['role', 'permissionId'],
        type: 'primary key',
        name: 'RolePermissions_pkey',
        transaction: t,
      });

      await queryInterface.createTable(
        'UserPermissions',
        {
          id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
          },
          userId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
              model: 'Users',
              key: 'id',
            },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
          },
          permissionId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
              model: 'Permissions',
              key: 'id',
            },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
          },
          grantedBy: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
              model: 'Users',
              key: 'id',
            },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
          },
          createdAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
          },
          updatedAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
          },
        },
        { transaction: t }
      );
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (t) => {
      await queryInterface.dropTable('UserPermissions', { transaction: t });
      await queryInterface.dropTable('RolePermissions', { transaction: t });
      await queryInterface.dropTable('Permissions', { transaction: t });
    });
  },
};
