const { DataTypes } = require('sequelize');
const sequelize = require('./database');

const Customer = sequelize.define('Customer', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false, validate: { len: [1, 255] } },
  email: { type: DataTypes.STRING, allowNull: false, unique: true, validate: { isEmail: true } },
  phone: { type: DataTypes.STRING, allowNull: false, validate: { is: /^[+]?[1-9][\d]{0,15}$/ } },
  status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'active', validate: { isIn: [['active', 'inactive', 'blacklisted']] } },
  documentNumber: { type: DataTypes.STRING, allowNull: true, unique: true },
  occupation: { type: DataTypes.STRING, allowNull: true },
  birthDate: { type: DataTypes.DATEONLY, allowNull: true },
  department: { type: DataTypes.STRING, allowNull: true },
  city: { type: DataTypes.STRING, allowNull: true },
  address: { type: DataTypes.STRING },
}, {
  timestamps: true,
  paranoid: true, // Enable paranoid mode for soft-delete with deletedAt
});

module.exports = Customer;
