const {
  Loan,
  Customer,
  Agent,
  Associate,
  User,
} = require('../../../models');
const { notificationService } = require('../../../services/NotificationService');
const { simulateCredit } = require('../../../services/creditSimulationService');
const { createLoanFromCanonicalData } = require('./loanCreation');

/**
 * Create the infrastructure ports consumed by the credits module composition seam.
 * @param {{ loanModel?: object, customerModel?: object, agentModel?: object, associateModel?: object, userModel?: object, creditSimulator?: Function, loanCreator?: Function, notifications?: object }} [options]
 * @returns {object}
 */
const createCreditsInfrastructure = ({
  loanModel = Loan,
  customerModel = Customer,
  agentModel = Agent,
  associateModel = Associate,
  userModel = User,
  creditSimulator = simulateCredit,
  loanCreator = createLoanFromCanonicalData,
  notifications = notificationService,
} = {}) => {
  const loanIncludes = [customerModel, agentModel, associateModel];

  return {
    loanRepository: {
      list() {
        return loanModel.findAll({ include: loanIncludes, order: [['createdAt', 'DESC']] });
      },
      findById(id) {
        return loanModel.findByPk(id, { include: loanIncludes });
      },
      listByCustomer(customerId) {
        return loanModel.findAll({ where: { customerId }, include: [agentModel, associateModel], order: [['createdAt', 'DESC']] });
      },
      listByAgent(agentId) {
        return loanModel.findAll({ where: { agentId }, include: [customerModel, associateModel], order: [['createdAt', 'DESC']] });
      },
      save(loan) {
        return loan.save();
      },
      destroy(loan) {
        return loan.destroy();
      },
    },
    customerRepository: {
      findById(id) {
        return customerModel.findByPk(id);
      },
    },
    agentRepository: {
      findById(id) {
        return agentModel.findByPk(id);
      },
    },
    userRepository: {
      findAgentUserByEmail(email) {
        return userModel.findOne({ where: { email, role: 'agent' } });
      },
    },
    creditDomainService: {
      simulate(input) {
        return creditSimulator(input);
      },
    },
    loanCreationService: {
      create(input) {
        return loanCreator(input);
      },
    },
    notificationPort: {
      sendAssignment(userId, payload) {
        return notifications.sendNotification(
          userId,
          `You have been assigned to Loan #${payload.loanId} (₹${payload.loanAmount}) for customer ${payload.customerName || 'Unknown'}. Please review and begin recovery process.`,
          'loan_assignment',
          payload,
        );
      },
    },
  };
};

const {
  loanRepository,
  customerRepository,
  agentRepository,
  userRepository,
  creditDomainService,
  loanCreationService,
  notificationPort,
} = createCreditsInfrastructure();

module.exports = {
  createCreditsInfrastructure,
  loanRepository,
  customerRepository,
  agentRepository,
  userRepository,
  creditDomainService,
  loanCreationService,
  notificationPort,
};
