const { Op } = require('sequelize');
const {
  Loan,
  Customer,
  Agent,
  Associate,
  User,
  DocumentAttachment,
  LoanAlert,
  PromiseToPay,
  Payment,
} = require('../../../models');
const { notificationService } = require('../../../services/NotificationService');
const { simulateCredit } = require('../../../services/creditSimulationService');
const { createLocalAttachmentStorage } = require('./attachmentStorage');
const { createLoanFromCanonicalData } = require('./loanCreation');
const { roundCurrency } = require('../../../services/creditFormulaHelpers');

const ACTIVE_PROMISE_STATUSES = ['pending', 'broken'];

/**
 * Create the infrastructure ports consumed by the credits module composition seam.
 * @param {{ loanModel?: object, customerModel?: object, agentModel?: object, associateModel?: object, userModel?: object, documentAttachmentModel?: object, creditSimulator?: Function, loanCreator?: Function, notifications?: object, attachmentStorage?: object }} [options]
 * @returns {object}
 */
const createCreditsInfrastructure = ({
  loanModel = Loan,
  customerModel = Customer,
  agentModel = Agent,
  associateModel = Associate,
  userModel = User,
  documentAttachmentModel = DocumentAttachment,
  loanAlertModel = LoanAlert,
  promiseToPayModel = PromiseToPay,
  paymentModel = Payment,
  creditSimulator = simulateCredit,
  loanCreator = createLoanFromCanonicalData,
  notifications = notificationService,
  attachmentStorage = createLocalAttachmentStorage(),
} = {}) => {
  const loanIncludes = [customerModel, agentModel, associateModel];

  return {
    loanRepository: {
      list() {
        return loanModel.findAll({ include: loanIncludes, order: [['createdAt', 'DESC']] });
      },
      listForOverdueAlertSync() {
        return loanModel.findAll({
          where: {
            status: { [Op.in]: ['approved', 'active', 'defaulted', 'closed'] },
          },
          include: loanIncludes,
          order: [['updatedAt', 'DESC']],
        });
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
    attachmentRepository: {
      listByLoan(loanId) {
        return documentAttachmentModel.findAll({
          where: { loanId },
          include: [{
            model: userModel,
            as: 'uploadedBy',
            attributes: ['id', 'name', 'email', 'role'],
          }],
          order: [['createdAt', 'DESC']],
        });
      },
      findByIdForLoan({ loanId, attachmentId }) {
        return documentAttachmentModel.findOne({
          where: { id: attachmentId, loanId },
          include: [{
            model: userModel,
            as: 'uploadedBy',
            attributes: ['id', 'name', 'email', 'role'],
          }],
        });
      },
      create(payload) {
        return documentAttachmentModel.create(payload);
      },
    },
    alertRepository: {
      listByLoan(loanId) {
        return loanAlertModel.findAll({
          where: { loanId },
          order: [['installmentNumber', 'ASC'], ['createdAt', 'DESC']],
        });
      },
      async syncOverdueInstallmentAlerts({ loan, schedule }) {
        const now = new Date();
        const overdueRows = schedule.filter((row) => {
          const outstanding = roundCurrency((row.remainingPrincipal || 0) + (row.remainingInterest || 0));
          return outstanding > 0 && new Date(row.dueDate) < now;
        });

        const existingAlerts = await loanAlertModel.findAll({ where: { loanId: loan.id } });
        const existingByInstallment = new Map(existingAlerts.map((alert) => [Number(alert.installmentNumber), alert]));
        const activeInstallments = new Set();

        for (const row of overdueRows) {
          const installmentNumber = Number(row.installmentNumber);
          activeInstallments.add(installmentNumber);
          const outstandingAmount = roundCurrency((row.remainingPrincipal || 0) + (row.remainingInterest || 0));
          const existingAlert = existingByInstallment.get(installmentNumber);

          if (existingAlert) {
            await existingAlert.update({
              status: 'active',
              scheduledAmount: roundCurrency(row.scheduledPayment || 0),
              outstandingAmount,
              dueDate: new Date(row.dueDate),
              resolvedAt: null,
              resolutionSource: null,
            });
            continue;
          }

          await loanAlertModel.create({
            loanId: loan.id,
            installmentNumber,
            alertType: 'overdue_installment',
            dueDate: new Date(row.dueDate),
            scheduledAmount: roundCurrency(row.scheduledPayment || 0),
            outstandingAmount,
            status: 'active',
          });
        }

        await Promise.all(existingAlerts
          .filter((alert) => alert.status === 'active' && !activeInstallments.has(Number(alert.installmentNumber)))
          .map((alert) => alert.update({
            status: 'resolved',
            outstandingAmount: 0,
            resolvedAt: new Date(),
            resolutionSource: 'payment_satisfied',
          })));

        return this.listByLoan(loan.id);
      },
    },
    promiseRepository: {
      listByLoan(loanId) {
        return promiseToPayModel.findAll({
          where: { loanId },
          include: [{
            model: userModel,
            as: 'createdBy',
            attributes: ['id', 'name', 'email', 'role'],
          }],
          order: [['promisedDate', 'ASC'], ['createdAt', 'DESC']],
        });
      },
      create(payload) {
        return promiseToPayModel.create(payload);
      },
      async expireBrokenPromises({ loanId, asOf = new Date() }) {
        const promises = await promiseToPayModel.findAll({
          where: {
            loanId,
            status: ACTIVE_PROMISE_STATUSES,
          },
        });

        const nextEntries = [];
        for (const promise of promises) {
          if (promise.status !== 'pending') {
            nextEntries.push(promise);
            continue;
          }

          if (new Date(promise.promisedDate) >= asOf) {
            nextEntries.push(promise);
            continue;
          }

          const history = Array.isArray(promise.statusHistory) ? [...promise.statusHistory] : [];
          history.push({
            status: 'broken',
            changedAt: asOf.toISOString(),
            reason: 'promised_date_elapsed',
          });
          await promise.update({
            status: 'broken',
            statusHistory: history,
            lastStatusChangedAt: asOf,
          });
          nextEntries.push(promise);
        }

        return this.listByLoan(loanId);
      },
    },
    paymentRepository: {
      listByLoan(loanId) {
        return paymentModel.findAll({
          where: { loanId },
          order: [['paymentDate', 'ASC'], ['createdAt', 'ASC']],
        });
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
          { dedupeKey: `loan-assignment:${payload.loanId}:${userId}` },
        );
      },
    },
    attachmentStorage,
  };
};

const {
  loanRepository,
  customerRepository,
  agentRepository,
  userRepository,
  attachmentRepository,
  alertRepository,
  promiseRepository,
  paymentRepository,
  creditDomainService,
  loanCreationService,
  notificationPort,
  attachmentStorage,
} = createCreditsInfrastructure();

module.exports = {
  createCreditsInfrastructure,
  loanRepository,
  customerRepository,
  agentRepository,
  userRepository,
  attachmentRepository,
  alertRepository,
  promiseRepository,
  paymentRepository,
  creditDomainService,
  loanCreationService,
  notificationPort,
  attachmentStorage,
};
