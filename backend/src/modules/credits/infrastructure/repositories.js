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
  DagGraphVersion,
  DagSimulationSummary,
  DagVariable,
} = require('@/models');
const { notificationService } = require('@/modules/notifications/application/notificationService');
const { createCreditCalculationService } = require('@/modules/credits/application/creditCalculationService');
const { createLocalAttachmentStorage } = require('./attachmentStorage');
const { createLoanFromCanonicalDataFactory } = require('./loanCreation');
const { roundCurrency } = require('@/modules/credits/application/creditFormulaHelpers');
const { normalizeUtcDateOnly } = require('@/modules/credits/application/loanFinancials');
const { createCreditsDagConfig } = require('@/modules/credits/application/dag/config');
const { createCreditsCalculationService } = require('@/modules/credits/application/dag/calculationAdapter');
const { createGraphExecutor } = require('@/modules/credits/application/dag/graphExecutor');

const { paginateModel } = require('@/modules/shared/pagination');

const ACTIVE_PROMISE_STATUSES = ['pending', 'broken'];
const MANUAL_ALERT_RESOLUTION_SOURCES = new Set(['manual_follow_up']);
const ACTIVE_LOAN_STATUSES = new Set(['approved', 'active', 'defaulted', 'overdue']);

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

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizeGraphRecord = (record) => (typeof record?.toJSON === 'function' ? record.toJSON() : record);

const graphReferencesVariable = (graph = {}, variableName) => {
  const normalizedName = String(variableName || '').trim();
  if (!normalizedName) return false;

  const tokenPattern = new RegExp(`(^|[^A-Za-z0-9_])${escapeRegExp(normalizedName)}([^A-Za-z0-9_]|$)`);
  const nodes = Array.isArray(graph?.nodes) ? graph.nodes : [];

  return nodes.some((node) => {
    if (String(node?.outputVar || '') === normalizedName) return true;
    if (Array.isArray(node?.dependencies) && node.dependencies.includes(normalizedName)) return true;
    if (typeof node?.formula === 'string' && tokenPattern.test(node.formula)) return true;
    if (typeof node?.label === 'string' && tokenPattern.test(node.label)) return true;
    if (node?.metadata && tokenPattern.test(JSON.stringify(node.metadata))) return true;
    return false;
  });
};

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

  if (actorRole === 'customer') {
    const customerId = Number(actor?.id);
    andClauses.push(Number.isFinite(customerId) ? { customerId } : buildImpossibleWhereClause());
  }

  if (actorRole === 'socio') {
    const associateId = Number(actor?.associateId);
    andClauses.push(Number.isFinite(associateId) ? { associateId } : buildImpossibleWhereClause());
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
 * The dependency chain is built lazily inside the function body so the
 * dagGraphRepository → graphExecutor → calculationService → creditSimulator
 * ordering is guaranteed.
 *
 * @param {{ loanModel?: object, customerModel?: object, associateModel?: object, userModel?: object, documentAttachmentModel?: object, notifications?: object, attachmentStorage?: object, dagConfig?: object }} [options]
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
  dagGraphVersionModel = DagGraphVersion,
  dagSimulationSummaryModel = DagSimulationSummary,
  dagVariableModel = DagVariable,
  dagConfig = createCreditsDagConfig(),
  notifications = notificationService,
  attachmentStorage = createLocalAttachmentStorage(),
  // Overridable for testing — if not provided, built below from the dag graph repository
  graphExecutorOverride,
  calculationServiceOverride,
  creditSimulatorOverride,
  detailedCreditSimulatorOverride,
  loanCreatorOverride,
} = {}) => {
  const loanIncludes = [
    customerModel,
    associateModel,
    {
      model: dagGraphVersionModel,
      as: 'dagGraph',
      attributes: ['id', 'scopeKey', 'name', 'version', 'status', 'createdAt', 'updatedAt'],
    },
  ];

  // ── Build dagGraphRepository first (needed by graphExecutor) ──────────
  const dagGraphRepository = {
    getLatest(scopeKey) {
      return dagGraphVersionModel.findOne({
        where: { scopeKey },
        order: [['version', 'DESC'], ['createdAt', 'DESC']],
      });
    },
    getLatestActive(scopeKey) {
      return dagGraphVersionModel.findOne({
        where: { scopeKey, status: 'active' },
        order: [['version', 'DESC'], ['createdAt', 'DESC']],
      });
    },
    async listByScopeKey(scopeKey) {
      const graphs = await dagGraphVersionModel.findAll({
        where: { scopeKey },
        order: [['version', 'DESC'], ['createdAt', 'DESC']],
        attributes: {
          include: [
            [
              Sequelize.literal(`(SELECT COUNT(*) FROM "Loans" WHERE "Loans"."dagGraphVersionId" = "DagGraphVersion"."id")`),
              'usageCount',
            ],
          ],
        },
      });
      return graphs;
    },
    async findById(id) {
      const graph = await dagGraphVersionModel.findByPk(id, {
        attributes: {
          include: [
            [
              Sequelize.literal(`(SELECT COUNT(*) FROM "Loans" WHERE "Loans"."dagGraphVersionId" = "DagGraphVersion"."id")`),
              'usageCount',
            ],
          ],
        },
      });
      return graph;
    },
    async findByScopeAndVersion(scopeKey, version) {
      return dagGraphVersionModel.findOne({
        where: { scopeKey, version },
        attributes: {
          include: [
            [
              Sequelize.literal(`(SELECT COUNT(*) FROM "Loans" WHERE "Loans"."dagGraphVersionId" = "DagGraphVersion"."id")`),
              'usageCount',
            ],
          ],
        },
      });
    },
    async getUsageCount(id) {
      const count = await loanModel.count({ where: { dagGraphVersionId: id } });
      return count;
    },
    async getVariableUsage(variableName) {
      const graphs = await dagGraphVersionModel.findAll({
        order: [['version', 'DESC'], ['createdAt', 'DESC']],
        attributes: {
          include: [
            [
              Sequelize.literal(`(SELECT COUNT(*) FROM "Loans" WHERE "Loans"."dagGraphVersionId" = "DagGraphVersion"."id")`),
              'usageCount',
            ],
          ],
        },
      });

      const references = graphs
        .map(normalizeGraphRecord)
        .filter((graph) => graphReferencesVariable(graph.graph, variableName))
        .map((graph) => {
          const graphUsageCount = Number(graph.usageCount || 0);
          return {
            graphId: graph.id,
            graphName: graph.name,
            version: graph.version,
            status: graph.status,
            usageCount: graphUsageCount,
            isActive: graph.status === 'active',
            isLocked: graphUsageCount > 0,
          };
        });

      return {
        count: references.length,
        references,
        isReferencedByActiveGraph: references.some((reference) => reference.isActive),
        isReferencedByLockedGraph: references.some((reference) => reference.isLocked),
        isReferencedByProtectedGraph: references.some((reference) => reference.isActive || reference.isLocked),
      };
    },
    countByScopeKey(scopeKey) {
      return dagGraphVersionModel.count({ where: { scopeKey } });
    },
    countActiveByScopeKey(scopeKey) {
      return dagGraphVersionModel.count({ where: { scopeKey, status: 'active' } });
    },
    async updateStatus(id, status) {
      const graph = await dagGraphVersionModel.findByPk(id);
      if (!graph) return null;
      graph.status = status;
      await graph.save();
      return graph;
    },
    async activateVersion(id) {
      const activated = await dagGraphVersionModel.sequelize.transaction(async (transaction) => {
        // Acquire an advisory lock on the scopeKey to prevent concurrent activations
        // This ensures only one activation per scope can happen at a time across all instances
        const targetGraph = await dagGraphVersionModel.findByPk(id, { transaction, lock: true });
        if (!targetGraph) {
          return null;
        }

        // Use advisory lock derived from scopeKey hash for cross-process serialization
        const scopeKeyHash = Buffer.from(targetGraph.scopeKey).reduce((h, c) => ((h << 5) - h + c) | 0, 0);
        await dagGraphVersionModel.sequelize.query(
          'SELECT pg_advisory_xact_lock(:lockId)',
          { replacements: { lockId: Math.abs(scopeKeyHash) % 2147483647 }, transaction }
        );

        // Re-verify no other active version was created while we waited for the lock
        const currentActive = await dagGraphVersionModel.findOne({
          where: { scopeKey: targetGraph.scopeKey, status: 'active' },
          transaction,
          lock: true,
        });

        if (currentActive && currentActive.id !== targetGraph.id) {
          await dagGraphVersionModel.update(
            { status: 'inactive' },
            {
              where: { id: currentActive.id },
              transaction,
            },
          );
        }

        targetGraph.status = 'active';
        await targetGraph.save({ transaction });
        return targetGraph.id;
      });

      if (!activated) {
        return null;
      }

      return this.findById(activated);
    },
    async deactivateVersion(id) {
      const graph = await dagGraphVersionModel.findByPk(id);
      if (!graph) {
        return null;
      }

      graph.status = 'inactive';
      await graph.save();
      return this.findById(id);
    },
    async deleteGraph(id) {
      const graph = await dagGraphVersionModel.findByPk(id);
      if (!graph) return null;
      await graph.destroy();
      return true;
    },
    async saveVersion(payload) {
      const latest = await this.getLatest(payload.scopeKey);
      const version = Number(latest?.version || 0) + 1;
      return dagGraphVersionModel.create({ ...payload, version, status: payload.status || 'inactive' });
    },
  };

  const dagVariableRepository = {
    async list({ type, source, status, page = 1, pageSize = 20 } = {}) {
      const where = {};
      if (type) where.type = type;
      if (source) where.source = source;
      if (status) where.status = status;
      return paginateModel({
        model: dagVariableModel,
        page,
        pageSize,
        where,
        order: [['createdAt', 'DESC']],
      });
    },
    async findById(id) {
      return dagVariableModel.findByPk(id);
    },
    async findByName(name) {
      return dagVariableModel.findOne({ where: { name } });
    },
    async create(payload) {
      return dagVariableModel.create(payload);
    },
    async update(id, payload) {
      const variable = await dagVariableModel.findByPk(id);
      if (!variable) return null;
      await variable.update(payload);
      return variable;
    },
    async delete(id) {
      const variable = await dagVariableModel.findByPk(id);
      if (!variable) return null;
      await variable.destroy();
      return true;
    },
  };

  // ── Build the dependency chain: graphExecutor → calculationService → credit calculations ──
  const graphExecutor = graphExecutorOverride || createGraphExecutor({ dagGraphRepository, dagVariableRepository });
  const calculationService = calculationServiceOverride || createCreditsCalculationService({
    graphExecutor,
  });
  const creditCalculationService = createCreditCalculationService({ calculationService });
  const creditCalculator = creditSimulatorOverride || creditCalculationService.calculate;
  const detailedCreditCalculator = detailedCreditSimulatorOverride || creditCalculationService.calculateDetailed;
  const loanCreator = loanCreatorOverride || createLoanFromCanonicalDataFactory({
    calculationService,
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
        const now = new Date();
        const overdueRows = schedule.filter((row) => {
          const outstanding = roundCurrency((row.remainingPrincipal || 0) + (row.remainingInterest || 0));
          return outstanding > 0 && new Date(row.dueDate) < now;
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
      async expireBrokenPromises({ loanId, asOf = new Date() }) {
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
        return creditCalculator(input);
      },
      calculateDetailed(input) {
        return detailedCreditCalculator(input);
      },
      simulate(input) {
        return creditCalculator(input);
      },
      simulateDetailed(input) {
        return detailedCreditCalculator(input);
      },
    },
    dagGraphRepository,
    dagVariableRepository,
    dagSimulationSummaryRepository: {
      save(payload) {
        return dagSimulationSummaryModel.create(payload);
      },
      getLatest(scopeKey) {
        return dagSimulationSummaryModel.findOne({
          where: { scopeKey },
          order: [['createdAt', 'DESC'], ['id', 'DESC']],
        });
      },
    },
    loanCreationService: {
      create(input) {
        return loanCreator(input);
      },
    },
    notificationPort: {
      sendRecoveryAssignment(userId, payload) {
        return notifications.sendNotification(
          userId,
          `You have been assigned to Loan #${payload.loanId} ($${payload.loanAmount}) for customer ${payload.customerName || 'Unknown'}. Please review and begin recovery process.`,
          'loan_assignment',
          payload,
          { dedupeKey: `loan-assignment:${payload.loanId}:${userId}` },
        );
      },
      sendLoanReminder(userId, payload) {
        return notifications.sendNotification(
          userId,
          `Reminder for Loan #${payload.loanId}: installment #${payload.installmentNumber || 0} is due on ${payload.dueDate}.`,
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
          `Promise to pay for Loan #${payload.loanId} is now ${payload.status}.`,
          'promise_status',
          payload,
          { dedupeKey: `promise-status:${payload.promiseId}:${payload.status}:${userId}` },
        );
      },
    },
    attachmentStorage,
    creditsDagConfig: dagConfig,
    creditsCalculationService: calculationService,
    graphExecutor,

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
  dagGraphRepository,
  dagSimulationSummaryRepository,
  dagVariableRepository,
  loanCreationService,
  notificationPort,
  attachmentStorage,
  graphExecutor,
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
  dagGraphRepository,
  dagSimulationSummaryRepository,
  dagVariableRepository,
  loanCreationService,
  notificationPort,
  attachmentStorage,
  graphExecutor,
};
