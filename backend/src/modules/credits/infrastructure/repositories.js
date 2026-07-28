const { Op, Sequelize } = require('sequelize');
const {
  Loan,
  Customer,
  Associate,
  User,
  DocumentAttachment,
  LoanAlert,
  PromiseToPay,
  Payment,
  CalculationProfileVersion,
} = require('@/models');
const { notificationService } = require('@/modules/notifications/application/notificationService');
const { createCreditCalculationService } = require('@/modules/credits/application/creditCalculationService');
const { createCreditPolicyResolver } = require('@/modules/credits/application/creditPolicyResolver');
const { configRepository } = require('@/modules/config/infrastructure/repositories');
const { createLocalAttachmentStorage } = require('./attachmentStorage');
const { createLoanFromCanonicalDataFactory } = require('./loanCreation');
const { roundCurrency } = require('@/modules/credits/application/creditFormulaHelpers');
const { normalizeUtcDateOnly } = require('@/modules/credits/application/loanFinancials');
const { getCurrentOperationalDateOnly } = require('@/modules/shared/dateUtils');
const {
  DEFAULT_CALCULATION_SCOPE_KEY,
  createProfileBackedCalculationService,
} = require('@/modules/credits/domain/calculation');

const { paginateModel } = require('@/modules/shared/pagination');

const ACTIVE_PROMISE_STATUSES = ['pending', 'broken'];
const MANUAL_ALERT_RESOLUTION_SOURCES = new Set(['manual_follow_up']);
const ACTIVE_LOAN_STATUSES = new Set(['approved', 'active', 'defaulted', 'overdue']);

/**
 * Translate promise status keys into Spanish operational labels.
 * @param {unknown} status
 * @returns {string}
 */
const formatPromiseNotificationStatus = (status) => ({
  pending: 'Pendiente',
  kept: 'Cumplida',
  broken: 'Incumplida',
  cancelled: 'Cancelada',
}[String(status || 'pending').trim().toLowerCase()] || 'Pendiente');

const toPlainRecord = (record) => (typeof record?.toJSON === 'function' ? record.toJSON() : record);

const getLoanOutstandingBalance = (loan) => {
  const snapshotOutstanding = Number(loan?.financialSnapshot?.outstandingBalance);
  if (Number.isFinite(snapshotOutstanding)) {
    return roundCurrency(snapshotOutstanding);
  }

  const principalOutstanding = Number(loan?.principalOutstanding);
  const interestOutstanding = Number(loan?.interestOutstanding);
  if (Number.isFinite(principalOutstanding) || Number.isFinite(interestOutstanding)) {
    return roundCurrency(
      (Number.isFinite(principalOutstanding) ? principalOutstanding : 0)
      + (Number.isFinite(interestOutstanding) ? interestOutstanding : 0),
    );
  }

  const totalPayable = Number(loan?.totalPayable);
  const totalPaid = Number(loan?.totalPaid);
  if (Number.isFinite(totalPayable) || Number.isFinite(totalPaid)) {
    return roundCurrency(Math.max((Number.isFinite(totalPayable) ? totalPayable : 0) - (Number.isFinite(totalPaid) ? totalPaid : 0), 0));
  }

  return 0;
};

const getLatestLoan = (loans) => loans.reduce((latest, current) => {
  if (!latest) {
    return current;
  }

  const latestTimestamp = new Date(latest.createdAt || 0).getTime();
  const currentTimestamp = new Date(current.createdAt || 0).getTime();

  if (currentTimestamp === latestTimestamp) {
    return Number(current.id || 0) > Number(latest.id || 0) ? current : latest;
  }

  return currentTimestamp > latestTimestamp ? current : latest;
}, null);

const buildCustomerSummary = (loans = []) => {
  const latestLoan = getLatestLoan(loans);

  return {
    totalLoans: loans.length,
    activeLoans: loans.filter((loan) => ACTIVE_LOAN_STATUSES.has(String(loan.status || '').toLowerCase())).length,
    totalOutstandingBalance: roundCurrency(loans.reduce((total, loan) => total + getLoanOutstandingBalance(loan), 0)),
    latestLoanId: latestLoan?.id ?? null,
    latestLoanStatus: latestLoan?.status ?? null,
  };
};

const normalizeOptionalSearchText = (value) => String(value || '').trim().toLowerCase();

const buildImpossibleWhereClause = () => ({ id: { [Op.eq]: null } });

const buildLowercaseLikeClause = (columnPath, searchPattern) => Sequelize.where(
  Sequelize.fn('LOWER', Sequelize.cast(Sequelize.col(columnPath), 'TEXT')),
  { [Op.like]: searchPattern },
);

/**
 * Build a database-level search predicate for loan portfolio listing so large
 * portfolios do not need to be fully materialized in application memory.
 * @param {{ actor?: object, filters?: object }} input
 * @returns {object|undefined}
 */
const buildLoanSearchWhere = ({ actor, filters = {} }) => {
  const andClauses = [];
  const normalizedStatus = normalizeOptionalSearchText(filters.status);
  const normalizedSearch = normalizeOptionalSearchText(filters.search);
  const actorRole = normalizeOptionalSearchText(actor?.role);
  const amountClause = {};

  const minAmount = Number(filters.minAmount);
  if (Number.isFinite(minAmount)) {
    amountClause[Op.gte] = minAmount;
  }

  const maxAmount = Number(filters.maxAmount);
  if (Number.isFinite(maxAmount)) {
    amountClause[Op.lte] = maxAmount;
  }

  if (Object.keys(amountClause).length > 0) {
    andClauses.push({ amount: amountClause });
  }

  if (normalizedStatus) {
    andClauses.push({ status: normalizedStatus });
  }

  if (filters.startDate || filters.endDate) {
    const createdAtClause = {};

    if (filters.startDate) {
      const startDate = new Date(filters.startDate);
      if (!Number.isNaN(startDate.getTime())) {
        createdAtClause[Op.gte] = startDate;
      }
    }

    if (filters.endDate) {
      const endDate = new Date(filters.endDate);
      if (!Number.isNaN(endDate.getTime())) {
        endDate.setHours(23, 59, 59, 999);
        createdAtClause[Op.lte] = endDate;
      }
    }

    if (Object.keys(createdAtClause).length > 0) {
      andClauses.push({ createdAt: createdAtClause });
    }
  }

  if (actor && actorRole !== 'admin' && actorRole !== 'employee') {
    andClauses.push(buildImpossibleWhereClause());
  }

  if (normalizedSearch) {
    const searchPattern = `%${normalizedSearch}%`;
    andClauses.push({
      [Op.or]: [
        buildLowercaseLikeClause('Loan.id', searchPattern),
        buildLowercaseLikeClause('Loan.customerId', searchPattern),
        buildLowercaseLikeClause('Loan.associateId', searchPattern),
        buildLowercaseLikeClause('Loan.status', searchPattern),
        buildLowercaseLikeClause('Customer.name', searchPattern),
        buildLowercaseLikeClause('Customer.email', searchPattern),
        buildLowercaseLikeClause('Associate.name', searchPattern),
        buildLowercaseLikeClause('Associate.email', searchPattern),
      ],
    });
  }

  return andClauses.length > 0 ? { [Op.and]: andClauses } : undefined;
};

/**
 * Create the infrastructure ports consumed by the credits module composition seam.
 *
 *
 * @param {{ loanModel?: object, customerModel?: object, associateModel?: object, userModel?: object, documentAttachmentModel?: object, notifications?: object, attachmentStorage?: object, configRepositoryPort?: object, policyResolverOverride?: object, clock?: Function }} [options]
 * @returns {object}
 */
const createCreditsInfrastructure = ({
  loanModel = Loan,
  customerModel = Customer,
  associateModel = Associate,
  userModel = User,
  documentAttachmentModel = DocumentAttachment,
  loanAlertModel = LoanAlert,
  promiseToPayModel = PromiseToPay,
  paymentModel = Payment,
  calculationProfileVersionModel = CalculationProfileVersion,
  configRepositoryPort = configRepository,
  notifications = notificationService,
  attachmentStorage = createLocalAttachmentStorage(),
  calculationServiceOverride,
  loanCreatorOverride,
  policyResolverOverride,
  clock = () => new Date(),
} = {}) => {
  const loanIncludes = [
    customerModel,
    associateModel,
    {
      model: calculationProfileVersionModel,
      as: 'calculationProfile',
      attributes: ['id', 'scopeKey', 'name', 'version', 'status', 'calculationMethod', 'createdAt', 'updatedAt'],
    },
  ];

  const calculationProfileRepository = {
    getLatestActive(scopeKey = DEFAULT_CALCULATION_SCOPE_KEY) {
      return calculationProfileVersionModel.findOne({
        where: { scopeKey, status: 'active' },
        order: [['version', 'DESC'], ['createdAt', 'DESC']],
      });
    },
    getLatest(scopeKey = DEFAULT_CALCULATION_SCOPE_KEY) {
      return calculationProfileVersionModel.findOne({
        where: { scopeKey },
        order: [['version', 'DESC'], ['createdAt', 'DESC']],
      });
    },
    findById(id) {
      return calculationProfileVersionModel.findByPk(id);
    },
    listByScopeKey(scopeKey = DEFAULT_CALCULATION_SCOPE_KEY) {
      return calculationProfileVersionModel.findAll({
        where: { scopeKey },
        order: [['version', 'DESC'], ['createdAt', 'DESC']],
      });
    },
    countUsage(id) {
      return loanModel.count({ where: { calculationProfileVersionId: id } });
    },
    async saveVersion(payload) {
      const latest = await this.getLatest(payload.scopeKey || DEFAULT_CALCULATION_SCOPE_KEY);
      const version = Number(latest?.version || 0) + 1;
      return calculationProfileVersionModel.create({
        ...payload,
        scopeKey: payload.scopeKey || DEFAULT_CALCULATION_SCOPE_KEY,
        version,
        status: payload.status || 'inactive',
      });
    },
    async activateVersion(id) {
      return calculationProfileVersionModel.sequelize.transaction(async (transaction) => {
        const targetProfile = await calculationProfileVersionModel.findByPk(id, { transaction, lock: true });
        if (!targetProfile) return null;

        await calculationProfileVersionModel.update(
          { status: 'inactive' },
          {
            where: {
              scopeKey: targetProfile.scopeKey,
              status: 'active',
              id: { [Op.ne]: targetProfile.id },
            },
            transaction,
          },
        );

        targetProfile.status = 'active';
        await targetProfile.save({ transaction });
        return targetProfile;
      });
    },
  };

  // Profile-backed calculation service is the runtime source of truth.
  const calculationService = calculationServiceOverride || createProfileBackedCalculationService({
    calculationProfileRepository,
  });
  const policyResolver = policyResolverOverride || createCreditPolicyResolver({ configRepository: configRepositoryPort });
  const creditCalculationService = createCreditCalculationService({ calculationService, policyResolver });
  const loanCreator = loanCreatorOverride || createLoanFromCanonicalDataFactory({
    calculationService,
    policyResolver,
    customerModel,
    associateModel,
    loanModel,
    financialProductModel: require('@/models').FinancialProduct,
  });

  return {
    loanRepository: {
      list() {
        return loanModel.findAll({ include: loanIncludes, order: [['createdAt', 'DESC']] });
      },
      listPage({ page, pageSize }) {
        return paginateModel({
          model: loanModel,
          page,
          pageSize,
          include: loanIncludes,
          order: [['createdAt', 'DESC']],
        });
      },
      search({ actor, filters = {} }) {
        return loanModel.findAll({
          where: buildLoanSearchWhere({ actor, filters }),
          include: loanIncludes,
          order: [['createdAt', 'DESC']],
        });
      },
      searchPage({ actor, filters = {}, page, pageSize }) {
        return paginateModel({
          model: loanModel,
          page,
          pageSize,
          where: buildLoanSearchWhere({ actor, filters }),
          include: loanIncludes,
          order: [['createdAt', 'DESC']],
        });
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
        return loanModel.findAll({ where: { customerId }, include: [associateModel, loanIncludes[2]], order: [['createdAt', 'DESC']] });
      },
      listPageByCustomer({ customerId, page, pageSize }) {
        return paginateModel({
          model: loanModel,
          page,
          pageSize,
          where: { customerId },
          include: [associateModel],
          order: [['createdAt', 'DESC']],
        });
      },
      async attachCustomerSummaries(loans) {
        if (!Array.isArray(loans) || loans.length === 0) {
          return [];
        }

        const customerIds = [...new Set(loans.map((loan) => Number(loan?.customerId)).filter(Number.isFinite))];
        const relatedLoans = customerIds.length > 0
          ? await loanModel.findAll({
            where: { customerId: customerIds },
            order: [['createdAt', 'DESC'], ['id', 'DESC']],
          })
          : [];

        const loansByCustomerId = new Map();
        relatedLoans.forEach((loanRecord) => {
          const loan = toPlainRecord(loanRecord);
          const loanCustomerId = Number(loan.customerId);
          const entries = loansByCustomerId.get(loanCustomerId) || [];
          entries.push(loan);
          loansByCustomerId.set(loanCustomerId, entries);
        });

        return loans.map((loanRecord) => {
          const loan = toPlainRecord(loanRecord);
          return {
            ...loan,
            customerSummary: buildCustomerSummary(loansByCustomerId.get(Number(loan.customerId)) || []),
          };
        });
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
    userRepository: {
      findRecoveryAssigneeUserByEmail(email) {
        return userModel.findOne({ where: { email } });
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
      findByIdForLoan({ loanId, alertId }) {
        return loanAlertModel.findOne({
          where: { id: alertId, loanId },
        });
      },
      create(payload) {
        return loanAlertModel.create(payload);
      },
      save(alert) {
        return alert.save();
      },
      async syncOverdueInstallmentAlerts({ loan, schedule }) {
        const operationalDate = getCurrentOperationalDateOnly(clock());
        const overdueRows = schedule.filter((row) => {
          if (['annulled', 'paid'].includes(String(row.status || '').toLowerCase())) {
            return false;
          }
          const outstanding = roundCurrency((row.remainingPrincipal || 0) + (row.remainingInterest || 0));
          const dueDate = normalizeUtcDateOnly(row.dueDate, 'Schedule due date');
          return outstanding > 0 && dueDate < operationalDate;
        });

        const existingAlerts = await loanAlertModel.findAll({ where: { loanId: loan.id } });
        const syncedAlerts = existingAlerts.filter((alert) => alert.alertType === 'overdue_installment');
        const existingByInstallment = new Map(syncedAlerts.map((alert) => [Number(alert.installmentNumber), alert]));
        const activeInstallments = new Set();

        for (const row of overdueRows) {
          const installmentNumber = Number(row.installmentNumber);
          activeInstallments.add(installmentNumber);
          const outstandingAmount = roundCurrency((row.remainingPrincipal || 0) + (row.remainingInterest || 0));
          const existingAlert = existingByInstallment.get(installmentNumber);

          if (existingAlert) {
            const keepManuallyResolved = existingAlert.status === 'resolved'
              && MANUAL_ALERT_RESOLUTION_SOURCES.has(String(existingAlert.resolutionSource || '').trim());

            await existingAlert.update({
              status: keepManuallyResolved ? 'resolved' : 'active',
              scheduledAmount: roundCurrency(row.scheduledPayment || 0),
              outstandingAmount,
              dueDate: new Date(row.dueDate),
              resolvedAt: keepManuallyResolved ? existingAlert.resolvedAt : null,
              resolutionSource: keepManuallyResolved ? existingAlert.resolutionSource : null,
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

        await Promise.all(syncedAlerts
          .filter((alert) => alert.status === 'active' && !activeInstallments.has(Number(alert.installmentNumber)))
          .map((alert) => alert.update({
            status: 'resolved',
            outstandingAmount: 0,
            resolvedAt: clock(),
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
      findByIdForLoan({ loanId, promiseId }) {
        return promiseToPayModel.findOne({
          where: { id: promiseId, loanId },
          include: [{
            model: userModel,
            as: 'createdBy',
            attributes: ['id', 'name', 'email', 'role'],
          }],
        });
      },
      async getCustomerForPromise(promiseId) {
        const promise = await promiseToPayModel.findByPk(promiseId, {
          include: [{
            model: loanModel,
            as: 'loan',
            include: [customerModel],
          }],
        });
        return promise?.loan?.Customer || null;
      },
      create(payload) {
        return promiseToPayModel.create(payload);
      },
      save(promise) {
        return promise.save();
      },
      async expireBrokenPromises({ loanId, asOf = getCurrentOperationalDateOnly(clock()) }) {
        const asOfDateOnly = normalizeUtcDateOnly(asOf, 'Promise expiration date');
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

          if (normalizeUtcDateOnly(promise.promisedDate, 'Promise date') >= asOfDateOnly) {
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
      calculate(input) {
        return creditCalculationService.calculate(input);
      },
      calculateDetailed(input) {
        return creditCalculationService.calculateDetailed(input);
      },
    },
    calculationProfileRepository,
    loanCreationService: {
      create(input) {
        return loanCreator(input);
      },
    },
    notificationPort: {
      sendLoanReminder(userId, payload) {
        return notifications.sendNotification(
          userId,
          `Recordatorio del crédito #${payload.loanId}: la cuota #${payload.installmentNumber || 0} vence el ${payload.dueDate}.`,
          'loan_reminder',
          payload,
          { dedupeKey: `loan-reminder:${payload.loanId}:${payload.alertId || payload.installmentNumber}:${userId}` },
        );
      },
      sendPaymentRegistered(userId, payload) {
        return notifications.sendNotification(
          userId,
          `Pago registrado en el crédito #${payload.loanId} por $${payload.amount}.`,
          'payment_registered',
          payload,
          { dedupeKey: `payment-registered:${payload.paymentId}:${userId}` },
        );
      },
      sendPromiseCreated(userId, payload) {
        return notifications.sendNotification(
          userId,
          `Compromiso de pago creado para el crédito #${payload.loanId} por $${payload.amount}.`,
          'promise_created',
          payload,
          { dedupeKey: `promise-created:${payload.promiseId}:${userId}` },
        );
      },
      sendPromiseStatus(userId, payload) {
        return notifications.sendNotification(
          userId,
          `Promesa de pago del crédito #${payload.loanId}: ${formatPromiseNotificationStatus(payload.status)}.`,
          'promise_status',
          payload,
          { dedupeKey: `promise-status:${payload.promiseId}:${payload.status}:${userId}` },
        );
      },
    },
    attachmentStorage,
  };
};

const {
  loanRepository,
  customerRepository,
  userRepository,
  attachmentRepository,
  alertRepository,
  promiseRepository,
  paymentRepository,
  creditDomainService,
  calculationProfileRepository,
  loanCreationService,
  notificationPort,
  attachmentStorage,
} = createCreditsInfrastructure();

module.exports = {
  createCreditsInfrastructure,
  loanRepository,
  customerRepository,
  userRepository,
  attachmentRepository,
  alertRepository,
  promiseRepository,
  paymentRepository,
  creditDomainService,
  calculationProfileRepository,
  loanCreationService,
  notificationPort,
  attachmentStorage,
};
