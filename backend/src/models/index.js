const sequelize = require('./database');
const Customer = require('./Customer');
const Agent = require('./Agent');
const Associate = require('./Associate');
const Loan = require('./Loan');
const Payment = require('./Payment');
const User = require('./User');

Loan.belongsTo(Customer, { foreignKey: 'customerId' });
Customer.hasMany(Loan, { foreignKey: 'customerId' });

Loan.belongsTo(Associate, { foreignKey: 'associateId' });
Associate.hasMany(Loan, { foreignKey: 'associateId' });

Loan.belongsTo(Agent, { foreignKey: 'agentId' });
Agent.hasMany(Loan, { foreignKey: 'agentId' });

Payment.belongsTo(Loan, { foreignKey: 'loanId' });
Loan.hasMany(Payment, { foreignKey: 'loanId' });

module.exports = {
  sequelize,
  Customer,
  Agent,
  Associate,
  Loan,
  Payment,
  User,
};
