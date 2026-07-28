const test = require('node:test');
const assert = require('node:assert/strict');

const { NotFoundError, ValidationError, AuthorizationError } = require('@/utils/errorHandler');
const AssociateInstallment = require('@/models/AssociateInstallment');
const {
  createListAssociates,
  createCreateAssociate,
  createGetAssociateById,
  createUpdateAssociate,
  createDeleteAssociate,
  createListAssociateFinancialDetails,
  createGetAssociateTracking,
  createCreateAssociateContribution,
  createCreateProfitDistribution,
  createCreateAssociateCapitalReturn,
  createCreateAssociateReinvestment,
  createGetAssociateInstallments,
  createPayAssociateInstallment,
  createGetAssociateCalendar,
} = require('@/modules/associates/application/useCases');

test('createListAssociates returns repository results in name order', async () => {
  const listAssociates = createListAssociates({
    associateRepository: {
      async list() {
        return [{ id: 4 }, { id: 3 }];
      },
    },
  });

  const associates = await listAssociates();
  assert.deepEqual(associates, [
    { id: 4, interestType: 'monthly', interestRate: '0.0000', interestPaymentDay: 1, interestPaymentMonth: null },
    { id: 3, interestType: 'monthly', interestRate: '0.0000', interestPaymentDay: 1, interestPaymentMonth: null },
  ]);
});

test('createListAssociates preserves pagination metadata with normalized associate rows', async () => {
  const listAssociates = createListAssociates({
    associateRepository: {
      async listPage() {
        return {
          items: [{ id: 4 }, { id: 3 }],
          pagination: { page: 2, pageSize: 5, totalItems: 7, totalPages: 2 },
        };
      },
    },
  });

  const result = await listAssociates({ pagination: { page: 2, pageSize: 5 } });

  assert.deepEqual(result, {
    items: [
      { id: 4, interestType: 'monthly', interestRate: '0.0000', interestPaymentDay: 1, interestPaymentMonth: null },
      { id: 3, interestType: 'monthly', interestRate: '0.0000', interestPaymentDay: 1, interestPaymentMonth: null },
    ],
    pagination: { page: 2, pageSize: 5, totalItems: 7, totalPages: 2 },
  });
});

test('createListAssociates enriches paginated rows with capital and next payment snapshots when financial data is available', async () => {
  const listAssociates = createListAssociates({
    associateRepository: {
      async listPage() {
        return {
          items: [{
            id: 4,
            name: 'Ana Associate',
            interestRate: '2.0000',
            interestType: 'monthly',
          }],
          pagination: { page: 1, pageSize: 25, totalItems: 1, totalPages: 1 },
        };
      },
      async getFinancialDatasetByAssociateIds() {
        return {
          contributions: [
            {
              id: 91,
              associateId: 4,
              amount: 1000,
              contributionDate: '2099-01-01',
              status: 'completed',
            },
          ],
          distributions: [
            {
              id: 92,
              associateId: 4,
              amount: 200,
              distributionDate: '2099-03-01',
              basis: { type: 'capital-return' },
            },
            {
              id: 93,
              associateId: 4,
              amount: 15,
              distributionDate: '2099-04-01',
              distributionType: 'manual',
              basis: { type: 'manual-interest' },
            },
          ],
          installments: [
            {
              id: 94,
              associateId: 4,
              installmentNumber: 1,
              amount: 20,
              dueDate: '2099-07-05',
              status: 'pending',
            },
            {
              id: 95,
              associateId: 4,
              installmentNumber: 2,
              amount: 25,
              dueDate: '2099-06-05',
              paidAt: '2099-06-05',
              status: 'paid',
            },
          ],
        };
      },
    },
  });

  const result = await listAssociates({ pagination: { page: 1, pageSize: 25 } });

  assert.deepEqual(result, {
    items: [{
      id: 4,
      name: 'Ana Associate',
      interestRate: '2.0000',
      interestType: 'monthly',
      interestPaymentDay: 1,
      interestPaymentMonth: null,
      totalContributed: 1000,
      currentCapital: 800,
      totalCapitalReturned: 200,
      interestPending: 20,
      interestOverdue: 0,
      scheduledInterestPaid: 25,
      manualInterestPaid: 15,
      interestPaid: 40,
      nextPaymentDate: '2099-07-05',
      nextInterestPaymentDate: '2099-07-05',
      lastPaymentDate: '2099-06-05',
      pendingInstallments: 1,
      overdueInstallments: 0,
      paidInstallments: 1,
      debtStatus: 'pending',
    }],
    pagination: { page: 1, pageSize: 25, totalItems: 1, totalPages: 1 },
  });
});

test('createListAssociates forwards normalized search and status filters to the repository', async () => {
  let forwardedFilters = null;
  const listAssociates = createListAssociates({
    associateRepository: {
      async listPage({ filters }) {
        forwardedFilters = filters;
        return {
          items: [{ id: 9 }],
          pagination: { page: 1, pageSize: 25, totalItems: 1, totalPages: 1 },
        };
      },
    },
  });

  const result = await listAssociates({
    pagination: { page: 1, pageSize: 25 },
    filters: { search: 'Ana', status: 'ACTIVE' },
  });

  assert.deepEqual(forwardedFilters, { search: 'Ana', status: 'active' });
  assert.equal(result.items[0].id, 9);
});

test('createListAssociates rejects unsupported status filters', async () => {
  const listAssociates = createListAssociates({
    associateRepository: {
      async list() {
        throw new Error('list should not be called');
      },
    },
  });

  await assert.rejects(() => listAssociates({
    filters: { status: 'blocked' },
  }), (error) => {
    assert.ok(error instanceof ValidationError);
    assert.equal(error.message, 'Filtro de estado de socio inválido.');
    return true;
  });
});

test('createGetAssociateById rejects when the record is missing', async () => {
  const getAssociateById = createGetAssociateById({
    associateRepository: {
      async findById() {
        return null;
      },
    },
  });

  await assert.rejects(() => getAssociateById(88), (error) => {
    assert.ok(error instanceof NotFoundError);
    assert.equal(error.message, 'El socio no existe.');
    return true;
  });
});

test('createUpdateAssociate persists changes through the repository', async () => {
  const associate = { id: 2, name: 'Before Update' };
  const updateAssociate = createUpdateAssociate({
    associateRepository: {
      async findById() {
        return associate;
      },
      async findConflictingContact() {
        return null;
      },
      async update(record, payload) {
        Object.assign(record, payload);
        return record;
      },
    },
  });

  const updatedAssociate = await updateAssociate({ associateId: 2, payload: { name: 'After Update' } });
  assert.equal(updatedAssociate.name, 'After Update');
});

test('createDeleteAssociate rejects when the record is missing', async () => {
  const deleteAssociate = createDeleteAssociate({
    associateRepository: {
      async findById() {
        return null;
      },
      async destroy() {
        throw new Error('destroy should not be called');
      },
    },
  });

  await assert.rejects(() => deleteAssociate({ associateId: 91 }), (error) => {
    assert.ok(error instanceof NotFoundError);
    return true;
  });
});

test('createDeleteAssociate preserves financial history by deactivating instead of destroying the associate', async () => {
  const associate = { id: 12, status: 'active', name: 'Socio Histórico' };
  let updatePayload = null;
  const deleteAssociate = createDeleteAssociate({
    associateRepository: {
      async findById(id) {
        assert.equal(Number(id), 12);
        return associate;
      },
      async update(record, payload) {
        assert.equal(record, associate);
        updatePayload = payload;
        return { ...record, ...payload };
      },
      async destroy() {
        throw new Error('destroy should not be called for associates with financial history');
      },
    },
  });

  const result = await deleteAssociate({ actor: { id: 1, role: 'admin' }, associateId: 12 });

  assert.deepEqual(updatePayload, { status: 'inactive' });
  assert.equal(result.status, 'inactive');
  assert.equal(result.name, 'Socio Histórico');
});

test('createCreateAssociate rejects removed associate contract fields', async () => {
  const createCalls = [];
  const createAssociate = createCreateAssociate({
    associateRepository: {
      async findConflictingContact() {
        return null;
      },
      async create(payload) {
        createCalls.push(payload);
        return { id: 12, ...payload };
      },
    },
  });

  await assert.rejects(() => createAssociate({
    actor: { id: 1, role: 'admin' },
    payload: {
      name: 'New Associate',
      email: 'associate@example.com',
      phone: '+573001112255',
      interestStartsAt: '2026-01-01',
    },
  }), (error) => {
    assert.ok(error instanceof ValidationError);
    assert.match(error.message, /contrato de socios/i);
    return true;
  });

  assert.equal(createCalls.length, 0);
});

test('createCreateAssociate records initial capital and schedules the first monthly interest payment', async () => {
  const calls = [];
  const createAssociate = createCreateAssociate({
    clock: () => new Date('2026-07-11T04:30:00.000Z'),
    associateRepository: {
      async findConflictingContact() {
        return null;
      },
      async runInTransaction(work) {
        return work('tx-1');
      },
      async create(payload, options) {
        calls.push(['createAssociate', payload, options]);
        return { id: 12, ...payload };
      },
      async createContribution(payload, options) {
        calls.push(['createContribution', payload, options]);
        return { id: 40, ...payload };
      },
      async createInstallment(payload, options) {
        calls.push(['createInstallment', payload, options]);
        return { id: 50, ...payload };
      },
    },
  });

  const associate = await createAssociate({
    actor: { id: 7, role: 'admin' },
    payload: {
      name: 'Socio Capital',
      email: 'socio.capital@example.com',
      phone: '+573001112244',
      initialCapital: '2000000',
      interestType: 'monthly',
      interestRate: '2.5',
      interestPaymentDay: 15,
    },
  });

  assert.equal(associate.id, 12);
  assert.equal(associate.interestType, 'monthly');
  assert.equal(associate.interestRate, '2.5000');
  assert.equal(calls[1][0], 'createContribution');
  assert.equal(calls[1][1].amount, 2000000);
  assert.equal(calls[1][1].createdByUserId, 7);
  assert.equal(calls[1][1].interestTypeSnapshot, 'monthly');
  assert.equal(calls[1][1].interestRateSnapshot, '2.5000');
  assert.equal(calls[1][1].contributionDate.toISOString().slice(0, 10), '2026-07-10');
  assert.equal(calls[2][0], 'createInstallment');
  assert.equal(calls[2][1].amount, 50000);
  assert.equal(calls[2][1].capitalBase, 2000000);
  assert.equal(calls[2][1].interestType, 'monthly');
  assert.equal(calls[2][1].interestRate, '2.5000');
  assert.equal(calls[2][1].dueDate.getUTCDate(), 15);
});

test('createCreateAssociate schedules annual interest on the configured month and day', async () => {
  let installmentPayload = null;
  const createAssociate = createCreateAssociate({
    associateRepository: {
      async findConflictingContact() {
        return null;
      },
      async runInTransaction(work) {
        return work();
      },
      async create(payload) {
        return { id: 77, ...payload };
      },
      async createContribution(payload) {
        return { id: 78, ...payload };
      },
      async createInstallment(payload) {
        installmentPayload = payload;
        return { id: 79, ...payload };
      },
    },
  });

  await createAssociate({
    actor: { id: 7, role: 'admin' },
    payload: {
      name: 'Socio Anual',
      email: 'socio.anual@example.com',
      phone: '+573001112245',
      initialCapital: 3000000,
      interestType: 'annual',
      interestRate: 12,
      interestPaymentMonth: 12,
      interestPaymentDay: 20,
    },
  });

  assert.equal(installmentPayload.amount, 360000);
  assert.equal(installmentPayload.interestType, 'annual');
  assert.equal(installmentPayload.dueDate.toISOString().slice(0, 10), '2026-12-20');
});

test('createCreateAssociate rejects invalid associate interest terms', async () => {
  const createAssociate = createCreateAssociate({
    associateRepository: {
      async findConflictingContact() {
        return null;
      },
      async create() {
        throw new Error('create should not be called');
      },
    },
  });

  await assert.rejects(() => createAssociate({
    actor: { id: 1, role: 'admin' },
    payload: {
      name: 'Bad Terms',
      email: 'bad.terms@example.com',
      phone: '+573001112246',
      interestType: 'weekly',
      interestRate: 2,
    },
  }), (error) => {
    assert.ok(error instanceof ValidationError);
    assert.equal(error.message, 'El tipo de interés debe ser mensual o anual');
    return true;
  });

  await assert.rejects(() => createAssociate({
    actor: { id: 1, role: 'admin' },
    payload: {
      name: 'Bad Payment Day',
      email: 'bad.payment.day@example.com',
      phone: '+573001112248',
      interestType: 'monthly',
      interestRate: 2,
      interestPaymentDay: '1e1',
    },
  }), (error) => {
    assert.ok(error instanceof ValidationError);
    assert.equal(error.message, 'El día de pago de intereses debe ser un entero entre 1 y 28');
    return true;
  });

  await assert.rejects(() => createAssociate({
    actor: { id: 1, role: 'admin' },
    payload: {
      name: 'Bad Payment Month',
      email: 'bad.payment.month@example.com',
      phone: '+573001112249',
      interestType: 'annual',
      interestRate: 2,
      interestPaymentMonth: '1e1',
    },
  }), (error) => {
    assert.ok(error instanceof ValidationError);
    assert.equal(error.message, 'El mes de pago de intereses debe ser un entero entre 1 y 12');
    return true;
  });
});

test('createCreateAssociate rejects duplicate contact details through the repository port', async () => {
  const createAssociate = createCreateAssociate({
    associateRepository: {
      async findConflictingContact() {
        return { id: 9, email: 'associate@example.com', phone: '+573001112255' };
      },
      async create() {
        throw new Error('create should not be called');
      },
    },
  });

  await assert.rejects(() => createAssociate({
    actor: { id: 1, role: 'admin' },
    payload: {
      name: 'New Associate',
      email: 'associate@example.com',
      phone: '+573001112255',
    },
  }), (error) => {
    assert.ok(error instanceof ValidationError);
    assert.deepEqual(error.errors, [
      { field: 'email', message: 'Ya existe un socio con ese correo.' },
      { field: 'phone', message: 'Ya existe un socio con ese teléfono.' },
    ]);
    return true;
  });
});

test('createListAssociateFinancialDetails aggregates financial details for authorized backoffice users', async () => {
  const listAssociateFinancialDetails = createListAssociateFinancialDetails({
    associateRepository: {
      async findById(id) {
        return { id, name: 'Partner One', interestType: 'monthly', interestRate: '2.0000' };
      },
      async listContributionsByAssociate() {
        return [{ id: 1, amount: 1000 }];
      },
      async listProfitDistributionsByAssociate() {
        return [
          {
            id: 2,
            amount: 150,
            distributionDate: new Date('2026-04-18T00:00:00.000Z'),
            createdBy: { id: 7, name: 'Operador Socios' },
            basis: { type: 'manual-interest' },
          },
          { id: 3, amount: 50, distributionDate: new Date('2026-04-10T00:00:00.000Z'), basis: { type: 'capital-return' } },
        ];
      },
      async findInstallmentsByAssociateId() {
        return [
          {
            id: 3,
            installmentNumber: 1,
            amount: 20,
            dueDate: new Date('2026-04-15'),
            status: 'paid',
            paidAt: new Date('2026-04-16'),
            paidByUser: { id: 1, name: 'Admin QA' },
          },
          { id: 4, amount: 20, dueDate: new Date('2026-05-15'), status: 'pending', paidAt: null },
        ];
      },
    },
  });

  const report = await listAssociateFinancialDetails({ actor: { id: 1, role: 'admin' }, associateId: 12 });

  assert.equal(report.associate.id, 12);
  assert.equal(report.summary.totalContributed, 1000);
  assert.equal(report.summary.currentCapital, 950);
  assert.equal(report.summary.totalCapitalReturned, 50);
  assert.equal(report.summary.totalInterestWithdrawn, 150);
  assert.equal(report.summary.scheduledInterestPaid, 20);
  assert.equal(report.summary.manualInterestPaid, 150);
  assert.equal(report.summary.totalInterestPaid, 170);
  assert.equal(report.summary.interestDebt, 20);
  assert.equal(report.summary.nextInterestPaymentDate, '2026-05-15');
  assert.equal(report.summary.debtStatus, 'pending');
  assert.equal(report.paymentHistory.length, 3);
  assert.equal(report.paymentHistory[0].displayType, 'Pago manual de rentabilidad');
  assert.equal(report.paymentHistory[0].paidByUser.name, 'Operador Socios');
  assert.equal(report.paymentHistory[1].displayType, 'Pago programado #1');
  assert.equal(report.paymentHistory[2].displayType, 'Devolución de capital');
  assert.equal(report.distributions[0].distributionType, 'manual');
  assert.equal(report.distributions[1].distributionType, 'capital_return');
  assert.equal(report.capitalReturns.length, 1);
  assert.equal(Object.hasOwn(report, 'loans'), false);
});

test('createListAssociateFinancialDetails labels scheduled payments even when installments are Sequelize instances', async () => {
  // Sequelize model instances keep their attributes on `dataValues` rather than
  // as own-enumerable properties, so `{ ...instance }` drops `installmentNumber`.
  // The display label must therefore read attributes directly, not via spread.
  const buildSequelizeLikeInstallment = (attributes) => {
    const instance = Object.create({
      toJSON() {
        return { ...attributes };
      },
    });
    Object.entries(attributes).forEach(([key, value]) => {
      Object.defineProperty(instance, key, {
        value,
        enumerable: false,
        configurable: true,
      });
    });
    return instance;
  };

  const listAssociateFinancialDetails = createListAssociateFinancialDetails({
    associateRepository: {
      async findById(id) {
        return { id, name: 'Partner One', interestType: 'monthly', interestRate: '5.0000' };
      },
      async listContributionsByAssociate() {
        return [{ id: 1, amount: 10000 }];
      },
      async listProfitDistributionsByAssociate() {
        return [];
      },
      async findInstallmentsByAssociateId() {
        return [
          buildSequelizeLikeInstallment({
            id: 5,
            installmentNumber: 1,
            amount: 500,
            dueDate: new Date('2026-06-01'),
            status: 'paid',
            paidAt: new Date('2026-06-16'),
            paidByUser: { id: 1, name: 'Admin QA' },
          }),
        ];
      },
    },
  });

  const report = await listAssociateFinancialDetails({ actor: { id: 1, role: 'admin' }, associateId: 4 });

  assert.equal(report.paymentHistory.length, 1);
  assert.equal(report.paymentHistory[0].installmentNumber, 1);
  assert.equal(report.paymentHistory[0].displayType, 'Pago programado #1');
});

test('createListAssociateFinancialDetails excludes non-completed contributions from capital totals', async () => {
  const listAssociateFinancialDetails = createListAssociateFinancialDetails({
    associateRepository: {
      async findById(id) {
        return { id, name: 'Partner One', interestType: 'monthly', interestRate: '2.0000' };
      },
      async listContributionsByAssociate() {
        return [
          { id: 1, amount: 1000, status: 'completed', contributionDate: new Date('2026-04-01T00:00:00.000Z') },
          { id: 2, amount: 500, status: 'pending', contributionDate: new Date('2026-04-10T00:00:00.000Z') },
          { id: 3, amount: 250, status: 'annulled', contributionDate: new Date('2026-04-12T00:00:00.000Z') },
          { id: 4, amount: 125, status: 'manual_hold', contributionDate: new Date('2026-04-14T00:00:00.000Z') },
        ];
      },
      async listProfitDistributionsByAssociate() {
        return [];
      },
      async findInstallmentsByAssociateId() {
        return [];
      },
    },
  });

  const report = await listAssociateFinancialDetails({ actor: { id: 1, role: 'admin' }, associateId: 12 });

  assert.equal(report.summary.totalContributed, 1000);
  assert.equal(report.summary.currentCapital, 1000);
  assert.equal(report.contributions.length, 4);
});

test('createGetAssociateTracking aggregates investor obligations inside associates module', async () => {
  let forwardedFilters = null;
  const getAssociateTracking = createGetAssociateTracking({
    clock: () => new Date('2026-05-10T00:00:00.000Z'),
    associateRepository: {
      async getTrackingDataset(filters) {
        forwardedFilters = filters;
        return {
          associates: [
            {
              id: 12,
              name: 'Socio Imagen',
              status: 'active',
              interestType: 'monthly',
              interestRate: '2.0000',
              interestPaymentDay: 15,
              interestPaymentMonth: null,
            },
          ],
          contributions: [
            { id: 1, associateId: 12, amount: 100000000, contributionDate: new Date('2026-04-01T00:00:00.000Z') },
          ],
          distributions: [
            {
              id: 5,
              associateId: 12,
              amount: 250000,
              distributionDate: new Date('2026-04-20T00:00:00.000Z'),
              distributionType: 'manual',
              createdBy: { id: 8, name: 'Operador Socios' },
            },
            {
              id: 6,
              associateId: 12,
              amount: 500000,
              distributionDate: new Date('2026-04-25T00:00:00.000Z'),
              createdBy: { id: 9, name: 'Tesorería' },
              basis: { type: 'capital-return' },
            },
          ],
          recentCapitalReturns: [],
          installments: [
            { id: 2, associateId: 12, installmentNumber: 1, amount: 2000000, dueDate: new Date('2026-05-15T00:00:00.000Z'), status: 'pending', interestRate: '2.0000', interestType: 'monthly', paidAt: null },
            { id: 3, associateId: 12, installmentNumber: 2, amount: 2000000, dueDate: new Date('2026-04-15T00:00:00.000Z'), status: 'overdue', interestRate: '2.0000', interestType: 'monthly', paidAt: null },
            { id: 4, associateId: 12, installmentNumber: 3, amount: 2000000, dueDate: new Date('2026-03-15T00:00:00.000Z'), status: 'paid', interestRate: '2.0000', interestType: 'monthly', paidAt: new Date('2026-03-16T00:00:00.000Z'), paidByUser: { id: 7, name: 'Admin QA' } },
          ],
        };
      },
      async updateInstallmentStatus() {
        throw new Error('No pending installment should expire in this scenario');
      },
    },
  });

  const tracking = await getAssociateTracking({
    actor: { id: 1, role: 'admin' },
    filters: { search: ' Imagen ', status: 'ACTIVE' },
  });

  assert.deepEqual(forwardedFilters, { search: 'Imagen', status: 'active' });
  assert.equal(tracking.summary.totalCapital, 99500000);
  assert.equal(tracking.summary.interestPending, 2000000);
  assert.equal(tracking.summary.interestOverdue, 2000000);
  assert.equal(tracking.summary.interestPaid, 2250000);
  assert.equal(tracking.summary.totalPayable, 4000000);
  assert.equal(tracking.associates[0].debtStatus, 'overdue');
  assert.equal(tracking.associates[0].interestPaid, 2250000);
  assert.equal(tracking.associates[0].nextPaymentDate, '2026-04-15');
  assert.equal(tracking.obligations.length, 2);
  assert.equal(tracking.recentPayments[0].displayType, 'Pago manual de rentabilidad');
  assert.equal(tracking.recentPayments[1].displayType, 'Pago programado #3');
  assert.equal(tracking.recentCapitalReturns[0].amount, 500000);
  assert.equal(tracking.recentCapitalReturns[0].createdBy.name, 'Tesorería');
  assert.equal(tracking.recentContributions[0].status, 'completed');
});

test('createGetAssociateTracking excludes non-completed contributions from capital tracking totals', async () => {
  const getAssociateTracking = createGetAssociateTracking({
    clock: () => new Date('2026-05-10T00:00:00.000Z'),
    associateRepository: {
      async getTrackingDataset() {
        return {
          associates: [
            {
              id: 12,
              name: 'Socio Imagen',
              status: 'active',
              interestType: 'monthly',
              interestRate: '2.0000',
              interestPaymentDay: 15,
              interestPaymentMonth: null,
            },
          ],
          contributions: [
            { id: 1, associateId: 12, amount: 1000, status: 'completed', contributionDate: new Date('2026-04-01T00:00:00.000Z') },
            { id: 2, associateId: 12, amount: 500, status: 'pending', contributionDate: new Date('2026-04-02T00:00:00.000Z') },
            { id: 3, associateId: 12, amount: 250, status: 'annulled', contributionDate: new Date('2026-04-03T00:00:00.000Z') },
          ],
          distributions: [],
          installments: [],
        };
      },
      async updateInstallmentStatus() {
        throw new Error('updateInstallmentStatus should not be called');
      },
    },
  });

  const tracking = await getAssociateTracking({
    actor: { id: 1, role: 'admin' },
    filters: {},
  });

  assert.equal(tracking.summary.totalCapital, 1000);
  assert.equal(tracking.associates[0].totalContributed, 1000);
  assert.equal(tracking.associates[0].currentCapital, 1000);
  assert.equal(tracking.recentContributions.length, 3);
});

test('createGetAssociateTracking preserves the full open obligations dataset without truncating after 20 rows', async () => {
  const getAssociateTracking = createGetAssociateTracking({
    clock: () => new Date('2026-05-10T00:00:00.000Z'),
    associateRepository: {
      async getTrackingDataset() {
        return {
          associates: [
            {
              id: 12,
              name: 'Socio Escalable',
              status: 'active',
              interestType: 'monthly',
              interestRate: '2.0000',
              interestPaymentDay: 15,
              interestPaymentMonth: null,
            },
          ],
          contributions: [
            { id: 1, associateId: 12, amount: 5000000, contributionDate: new Date('2026-04-01T00:00:00.000Z') },
          ],
          distributions: [],
          recentCapitalReturns: [],
          installments: Array.from({ length: 25 }, (_, index) => ({
            id: index + 1,
            associateId: 12,
            installmentNumber: index + 1,
            amount: 100000,
            dueDate: new Date(`2026-06-${String((index % 28) + 1).padStart(2, '0')}T00:00:00.000Z`),
            status: 'pending',
            interestRate: '2.0000',
            interestType: 'monthly',
            paidAt: null,
          })),
        };
      },
      async updateInstallmentStatus() {
        throw new Error('updateInstallmentStatus should not be called');
      },
    },
  });

  const tracking = await getAssociateTracking({
    actor: { id: 1, role: 'admin' },
    filters: {},
  });

  assert.equal(tracking.obligations.length, 25);
  assert.equal(tracking.summary.upcomingObligations, 25);
  assert.equal(tracking.obligations.at(-1)?.installmentNumber, 25);
});

test('createCreateAssociateCapitalReturn reduces current capital and reprojections pending interest', async () => {
  const calls = [];
  let createdDistribution = null;
  const createAssociateCapitalReturn = createCreateAssociateCapitalReturn({
    associateRepository: {
      async findById() {
        return { id: 12, name: 'Socio Capital', interestType: 'monthly', interestRate: '2.0000', interestPaymentDay: 15 };
      },
      async runInTransaction(work) {
        return work('tx-1');
      },
      async listContributionsByAssociate() {
        return [{ id: 1, amount: 1000, contributionDate: new Date('2026-04-01T00:00:00.000Z') }];
      },
      async listProfitDistributionsByAssociate() {
        return createdDistribution ? [createdDistribution] : [];
      },
      async createProfitDistribution(payload) {
        calls.push(['createProfitDistribution', payload]);
        createdDistribution = { id: 10, ...payload };
        return createdDistribution;
      },
      async findInstallmentsByAssociateId() {
        return [{
          id: 5,
          associateId: 12,
          installmentNumber: 2,
          amount: 20,
          dueDate: new Date('2026-05-15T00:00:00.000Z'),
          status: 'pending',
        }];
      },
      async updateInstallmentProjection(installmentId, payload) {
        calls.push(['updateInstallmentProjection', installmentId, payload]);
        return { id: installmentId, ...payload };
      },
      async createInstallment() {
        throw new Error('createInstallment should not be called when a pending installment already exists');
      },
    },
  });

  const result = await createAssociateCapitalReturn({
    actor: { id: 1, role: 'admin' },
    associateId: 12,
    payload: { amount: 200, capitalReturnDate: '2026-05-01T00:00:00.000Z' },
  });

  assert.equal(result.summary.previousCurrentCapital, 1000);
  assert.equal(result.summary.currentCapital, 800);
  assert.equal(calls[0][0], 'createProfitDistribution');
  assert.equal(calls[1][0], 'updateInstallmentProjection');
  assert.equal(calls[1][2].capitalBase, 800);
  assert.equal(calls[1][2].amount, 16);
});

test('createCreateAssociateCapitalReturn rejects the retired distribution date alias', async () => {
  const createCapitalReturn = createCreateAssociateCapitalReturn({
    associateRepository: {
      async findById() {
        return { id: 12, status: 'active' };
      },
    },
  });

  await assert.rejects(() => createCapitalReturn({
    actor: { id: 1, role: 'admin' },
    associateId: 12,
    payload: { amount: 100, distributionDate: '2026-07-09' },
  }), (error) => {
    assert.ok(error instanceof ValidationError);
    assert.match(error.message, /contrato de socios/i);
    return true;
  });
});

test('createListAssociateFinancialDetails rejects socio records before associate lookup', async () => {
  const listAssociateFinancialDetails = createListAssociateFinancialDetails({
    associateRepository: {
      async findById() {
        throw new Error('findById should not be called for socio records');
      },
      async listContributionsByAssociate() {
        throw new Error('listContributionsByAssociate should not be called');
      },
      async listProfitDistributionsByAssociate() {
        throw new Error('listProfitDistributionsByAssociate should not be called');
      },
      async findInstallmentsByAssociateId() {
        throw new Error('findInstallmentsByAssociateId should not be called');
      },
    },
  });

  await assert.rejects(() => listAssociateFinancialDetails({
    actor: { id: 9, role: 'socio', associateId: 12 },
    associateId: 12,
  }), (error) => {
    assert.ok(error instanceof AuthorizationError);
    assert.equal(error.message, 'Solo usuarios administrativos autorizados pueden consultar información financiera de socios.');
    return true;
  });
});

test('createListAssociateFinancialDetails requires an associate for backoffice financial details', async () => {
  const listAssociateFinancialDetails = createListAssociateFinancialDetails({
    associateRepository: {
      async findById() {
        throw new Error('findById should not be called without an associate id');
      },
      async listContributionsByAssociate() {
        throw new Error('listContributionsByAssociate should not be called');
      },
      async listProfitDistributionsByAssociate() {
        throw new Error('listProfitDistributionsByAssociate should not be called');
      },
      async findInstallmentsByAssociateId() {
        throw new Error('findInstallmentsByAssociateId should not be called');
      },
    },
  });

  await assert.rejects(() => listAssociateFinancialDetails({
    actor: { id: 9, role: 'admin' },
    associateId: null,
  }), (error) => {
    assert.ok(error instanceof ValidationError);
    assert.equal(error.message, 'Selecciona un socio para consultar su información financiera.');
    return true;
  });
});

test('createCreateAssociateContribution rejects non-admin actors with an operator-facing message', async () => {
  const createAssociateContribution = createCreateAssociateContribution({
    associateRepository: {
      async findById() {
        throw new Error('findById should not be called');
      },
    },
  });

  await assert.rejects(() => createAssociateContribution({
    actor: { id: 9, role: 'socio', associateId: 12 },
    associateId: 12,
    payload: { amount: 50 },
  }), (error) => {
    assert.ok(error instanceof AuthorizationError);
    assert.equal(error.message, 'Solo usuarios administrativos autorizados pueden registrar aportes de socios.');
    return true;
  });
});

test('createCreateAssociateContribution validates positive amounts', async () => {
  const calls = [];
  const createAssociateContribution = createCreateAssociateContribution({
    associateRepository: {
      async findById() {
        return { id: 12, interestType: 'monthly', interestRate: '1.5000', interestPaymentDay: 10 };
      },
      async listContributionsByAssociate() {
        return [{ amount: 500 }];
      },
      async findInstallmentsByAssociateId() {
        return [];
      },
      async createContribution(payload) {
        calls.push(['createContribution', payload]);
        return { id: 4, ...payload };
      },
      async createInstallment(payload) {
        calls.push(['createInstallment', payload]);
        return { id: 5, ...payload };
      },
    },
  });

  const contribution = await createAssociateContribution({
    actor: { id: 1, role: 'admin' },
    associateId: 12,
    payload: { amount: 500, notes: 'Capital infusion' },
  });

  assert.equal(contribution.id, 4);
  assert.equal(contribution.amount, 500);
  assert.equal(calls[0][1].status, 'completed');
  assert.equal(calls[0][1].interestTypeSnapshot, 'monthly');
  assert.equal(calls[0][1].interestRateSnapshot, '1.5000');
  assert.equal(calls[1][0], 'createInstallment');
  assert.equal(calls[1][1].amount, 7.5);
  assert.equal(calls[1][1].capitalBase, 500);
});

test('createCreateAssociateContribution schedules interest from historical contribution rate snapshots', async () => {
  const calls = [];
  const createAssociateContribution = createCreateAssociateContribution({
    associateRepository: {
      async findById() {
        return { id: 12, interestType: 'monthly', interestRate: '1.5000', interestPaymentDay: 10 };
      },
      async listContributionsByAssociate() {
        return [
          { amount: 1000000, interestTypeSnapshot: 'monthly', interestRateSnapshot: '2.5000' },
          { amount: 500000, interestTypeSnapshot: 'monthly', interestRateSnapshot: '1.5000' },
        ];
      },
      async findInstallmentsByAssociateId() {
        return [];
      },
      async createContribution(payload) {
        calls.push(['createContribution', payload]);
        return { id: 4, ...payload };
      },
      async createInstallment(payload) {
        calls.push(['createInstallment', payload]);
        return { id: 5, ...payload };
      },
    },
  });

  await createAssociateContribution({
    actor: { id: 1, role: 'admin' },
    associateId: 12,
    payload: { amount: 500000, notes: 'Capital con nueva tasa' },
  });

  assert.equal(calls[1][0], 'createInstallment');
  assert.equal(calls[1][1].capitalBase, 1500000);
  assert.equal(calls[1][1].amount, 32500);
  assert.equal(calls[1][1].interestRate, '2.1667');
});

test('createCreateAssociateContribution wraps contribution persistence and interest projection in one transaction', async () => {
  const calls = [];
  const createAssociateContribution = createCreateAssociateContribution({
    associateRepository: {
      async findById() {
        return { id: 12, interestType: 'monthly', interestRate: '1.5000', interestPaymentDay: 10 };
      },
      async runInTransaction(work) {
        calls.push(['runInTransaction']);
        return work('tx-1');
      },
      async listContributionsByAssociate(_associateId, options) {
        calls.push(['listContributionsByAssociate', options]);
        return [{ amount: 500000, status: 'completed', interestTypeSnapshot: 'monthly', interestRateSnapshot: '1.5000' }];
      },
      async listProfitDistributionsByAssociate(_associateId, options) {
        calls.push(['listProfitDistributionsByAssociate', options]);
        return [];
      },
      async findInstallmentsByAssociateId(_associateId, options) {
        calls.push(['findInstallmentsByAssociateId', options]);
        return [];
      },
      async createContribution(payload, options) {
        calls.push(['createContribution', payload, options]);
        return { id: 4, ...payload };
      },
      async createInstallment(payload, options) {
        calls.push(['createInstallment', payload, options]);
        return { id: 5, ...payload };
      },
    },
  });

  await createAssociateContribution({
    actor: { id: 1, role: 'admin' },
    associateId: 12,
    payload: { amount: 500000, notes: 'Capital con transacción' },
  });

  assert.equal(calls[0][0], 'runInTransaction');
  assert.equal(calls[1][0], 'createContribution');
  assert.equal(calls[1][2].transaction, 'tx-1');
  assert.equal(calls[2][0], 'listContributionsByAssociate');
  assert.equal(calls[2][1].transaction, 'tx-1');
  assert.equal(calls[3][0], 'listProfitDistributionsByAssociate');
  assert.equal(calls[3][1].transaction, 'tx-1');
  assert.equal(calls[4][0], 'findInstallmentsByAssociateId');
  assert.equal(calls[4][1].transaction, 'tx-1');
  assert.equal(calls[5][0], 'createInstallment');
  assert.equal(calls[5][2].transaction, 'tx-1');
});

test('createCreateAssociateContribution does not schedule interest for pending contributions without active capital', async () => {
  const calls = [];
  const createAssociateContribution = createCreateAssociateContribution({
    associateRepository: {
      async findById() {
        return { id: 12, interestType: 'monthly', interestRate: '1.5000', interestPaymentDay: 10 };
      },
      async listContributionsByAssociate() {
        return [{ amount: 500000, status: 'pending', interestTypeSnapshot: 'monthly', interestRateSnapshot: '1.5000' }];
      },
      async listProfitDistributionsByAssociate() {
        return [];
      },
      async findInstallmentsByAssociateId() {
        return [];
      },
      async createContribution(payload) {
        calls.push(['createContribution', payload]);
        return { id: 4, ...payload };
      },
      async createInstallment(payload) {
        calls.push(['createInstallment', payload]);
        return { id: 5, ...payload };
      },
    },
  });

  await createAssociateContribution({
    actor: { id: 1, role: 'admin' },
    associateId: 12,
    payload: { amount: 500000, status: 'pending', notes: 'Aporte en conciliación' },
  });

  assert.equal(calls[0][0], 'createContribution');
  assert.equal(calls[0][1].status, 'pending');
  assert.equal(calls.some(([name]) => name === 'createInstallment'), false);
});

test('associate money movement use cases reject ambiguous currency amounts', async () => {
  const repository = {
    async findById() {
      return { id: 12, interestType: 'monthly', interestRate: '1.5000', interestPaymentDay: 10 };
    },
    async runInTransaction() {
      throw new Error('runInTransaction should not be called');
    },
    async createContribution() {
      throw new Error('createContribution should not be called');
    },
    async createProfitDistribution() {
      throw new Error('createProfitDistribution should not be called');
    },
  };

  const createAssociateContribution = createCreateAssociateContribution({ associateRepository: repository });
  const createProfitDistribution = createCreateProfitDistribution({ associateRepository: repository });
  const createAssociateReinvestment = createCreateAssociateReinvestment({ associateRepository: repository });

  await assert.rejects(() => createAssociateContribution({
    actor: { id: 1, role: 'admin' },
    associateId: 12,
    payload: { amount: '1e2' },
  }), (error) => {
    assert.ok(error instanceof ValidationError);
    assert.match(error.message, /El monto del aporte/);
    return true;
  });

  await assert.rejects(() => createProfitDistribution({
    actor: { id: 1, role: 'admin' },
    associateId: 12,
    payload: { amount: '50.999' },
  }), (error) => {
    assert.ok(error instanceof ValidationError);
    assert.match(error.message, /El monto de la distribución/);
    return true;
  });

  await assert.rejects(() => createAssociateReinvestment({
    actor: { id: 1, role: 'admin' },
    associateId: 12,
    payload: { amount: '100abc' },
  }), (error) => {
    assert.ok(error instanceof ValidationError);
    assert.match(error.message, /El monto de la reinversión/);
    return true;
  });
});

test('associate money movement use cases reject malformed operational dates', async () => {
  const repository = {
    async findById() {
      return { id: 12, interestType: 'monthly', interestRate: '1.5000', interestPaymentDay: 10 };
    },
    async listContributionsByAssociate() {
      return [{ amount: 500 }];
    },
    async findInstallmentsByAssociateId() {
      return [];
    },
    async createContribution() {
      throw new Error('createContribution should not be called');
    },
    async createProfitDistribution() {
      throw new Error('createProfitDistribution should not be called');
    },
  };

  const createAssociateContribution = createCreateAssociateContribution({ associateRepository: repository });
  const createProfitDistribution = createCreateProfitDistribution({ associateRepository: repository });

  await assert.rejects(() => createAssociateContribution({
    actor: { id: 1, role: 'admin' },
    associateId: 12,
    payload: { amount: 500, contributionDate: '60517-02-14' },
  }), (error) => {
    assert.ok(error instanceof ValidationError);
    assert.match(error.message, /La fecha del aporte/);
    return true;
  });

  await assert.rejects(() => createProfitDistribution({
    actor: { id: 1, role: 'admin' },
    associateId: 12,
    payload: { amount: 500, distributionDate: '+060517-02-14T00:00:00.000Z' },
  }), (error) => {
    assert.ok(error instanceof ValidationError);
    assert.match(error.message, /La fecha de distribución/);
    return true;
  });
});

test('createCreateProfitDistribution rejects non-admin actors', async () => {
  const createProfitDistribution = createCreateProfitDistribution({
    associateRepository: {
      async findById() {
        return { id: 12 };
      },
      async createProfitDistribution() {
        throw new Error('should not be called');
      },
    },
  });

  await assert.rejects(() => createProfitDistribution({
    actor: { id: 9, role: 'socio', associateId: 12 },
    associateId: 12,
    payload: { amount: 50 },
  }), (error) => {
    assert.ok(error instanceof AuthorizationError);
    assert.equal(error.message, 'Solo usuarios administrativos autorizados pueden registrar distribuciones de utilidades.');
    return true;
  });
});

test('createCreateProfitDistribution rejects caller-controlled movement bases', async () => {
  const createProfitDistribution = createCreateProfitDistribution({
    associateRepository: {
      async findById() {
        return { id: 12, status: 'active' };
      },
      async createProfitDistribution() {
        throw new Error('createProfitDistribution should not be called');
      },
    },
  });

  await assert.rejects(() => createProfitDistribution({
    actor: { id: 1, role: 'admin' },
    associateId: 12,
    payload: { amount: 500, basis: { type: 'proportional' } },
  }), (error) => {
    assert.ok(error instanceof ValidationError);
    assert.match(error.message, /contrato de socios/i);
    return true;
  });
});

test('associate movement use cases reject retired associate fields instead of ignoring them', async () => {
  const repository = {
    async findById() {
      return { id: 12, status: 'active' };
    },
    async createContribution() {
      throw new Error('createContribution should not be called');
    },
    async createProfitDistribution() {
      throw new Error('createProfitDistribution should not be called');
    },
  };
  const createAssociateContribution = createCreateAssociateContribution({ associateRepository: repository });
  const createProfitDistribution = createCreateProfitDistribution({ associateRepository: repository });

  for (const useCase of [createAssociateContribution, createProfitDistribution]) {
    await assert.rejects(() => useCase({
      actor: { id: 1, role: 'admin' },
      associateId: 12,
      payload: { amount: 500, interestStartDate: '2026-01-01' },
    }), (error) => {
      assert.ok(error instanceof ValidationError);
      assert.match(error.message, /campos de participación/i);
      return true;
    });
  }
});

test('createCreateAssociateReinvestment records paired distribution and contribution entries', async () => {
  const calls = [];
  const createAssociateReinvestment = createCreateAssociateReinvestment({
    associateRepository: {
      async findById() {
        return { id: 12, name: 'Partner One' };
      },
      async runInTransaction(work) {
        return work();
      },
      async createProfitDistribution(payload) {
        calls.push(['distribution', payload]);
        return { id: 41, ...payload };
      },
      async createContribution(payload) {
        calls.push(['contribution', payload]);
        return { id: 42, ...payload };
      },
    },
  });

  const result = await createAssociateReinvestment({
    actor: { id: 1, role: 'admin' },
    associateId: 12,
    payload: { amount: 80, reinvestmentDate: '2026-03-20', notes: 'Reinvested' },
  });

  assert.equal(result.distribution.id, 41);
  assert.equal(result.contribution.id, 42);
  assert.equal(calls.find(([type]) => type === 'distribution')[1].basis.contributionId, 42);
  assert.equal(calls.length, 2);
});

test('createGetAssociateInstallments returns installments with totals', async () => {
  const getInstallments = createGetAssociateInstallments({
    associateRepository: {
      async findInstallmentsByAssociateId(associateId) {
        return [
          { id: 1, installmentNumber: 1, amount: 100, dueDate: new Date('2026-01-01'), status: 'paid', paidAt: new Date('2026-01-15'), paidBy: 1, paidByUser: { id: 1, name: 'Admin' } },
          { id: 2, installmentNumber: 2, amount: 100, dueDate: new Date('2199-02-01'), status: 'pending', paidAt: null, paidBy: null, paidByUser: null },
          { id: 3, installmentNumber: 3, amount: 100, dueDate: new Date('2199-03-01'), status: 'pending', paidAt: null, paidBy: null, paidByUser: null },
        ];
      },
      async findById() {
        return { id: 12, name: 'Partner One' };
      },
    },
  });

  const result = await getInstallments({ actor: { id: 1, role: 'admin' }, associateId: 12 });

  assert.equal(result.associateId, 12);
  assert.equal(result.installments.length, 3);
  assert.equal(result.totals.totalPaid, 100);
  assert.equal(result.totals.totalPending, 200);
});

test('createGetAssociateInstallments separates overdue installments from pending totals', async () => {
  const calls = [];
  const getInstallments = createGetAssociateInstallments({
    associateRepository: {
      async findInstallmentsByAssociateId() {
        return [
          { id: 1, installmentNumber: 1, amount: 100, dueDate: new Date('2000-01-01'), status: 'pending', paidAt: null, paidBy: null, paidByUser: null },
          { id: 2, installmentNumber: 2, amount: 75, dueDate: new Date('2199-01-01'), status: 'pending', paidAt: null, paidBy: null, paidByUser: null },
          { id: 3, installmentNumber: 3, amount: 50, dueDate: new Date('2000-02-01'), status: 'paid', paidAt: new Date('2000-02-02'), paidBy: 1, paidByUser: { id: 1, name: 'Admin' } },
        ];
      },
      async findById() {
        return { id: 12, name: 'Partner One' };
      },
      async updateInstallmentStatus(associateId, installmentNumber, status, paidAt, paidBy) {
        calls.push({ associateId, installmentNumber, status, paidAt, paidBy });
      },
    },
  });

  const result = await getInstallments({ actor: { id: 1, role: 'admin' }, associateId: 12 });

  assert.deepEqual(calls, [
    { associateId: 12, installmentNumber: 1, status: 'overdue', paidAt: null, paidBy: null },
  ]);
  assert.equal(result.installments[0].status, 'overdue');
  assert.equal(result.installments[1].status, 'pending');
  assert.equal(result.installments[2].status, 'paid');
  assert.equal(result.totals.totalOverdue, 100);
  assert.equal(result.totals.totalPending, 75);
  assert.equal(result.totals.totalPaid, 50);
});

test('createGetAssociateInstallments keeps a Bogotá due-date installment pending for the entire operational day', async () => {
  const statusUpdates = [];
  const getInstallments = createGetAssociateInstallments({
    clock: () => new Date('2026-07-28T02:30:00.000Z'),
    associateRepository: {
      async findInstallmentsByAssociateId() {
        return [
          {
            id: 1,
            installmentNumber: 1,
            amount: 20000,
            dueDate: new Date('2026-07-27T00:00:00.000Z'),
            status: 'pending',
            paidAt: null,
            paidBy: null,
            paidByUser: null,
          },
        ];
      },
      async findById() {
        return { id: 12, name: 'Socio Bogotá' };
      },
      async updateInstallmentStatus(...args) {
        statusUpdates.push(args);
      },
    },
  });

  const result = await getInstallments({ actor: { id: 1, role: 'admin' }, associateId: 12 });

  assert.equal(result.installments[0].status, 'pending');
  assert.equal(result.installments[0].amount, 20000);
  assert.equal(result.totals.totalPending, 20000);
  assert.deepEqual(statusUpdates, []);
});

test('createGetAssociateInstallments preserves Sequelize installment values when marking them overdue', async () => {
  const persistedInstallment = AssociateInstallment.build({
    id: 9,
    associateId: 12,
    installmentNumber: 3,
    amount: 20000,
    dueDate: new Date('2026-07-26T00:00:00.000Z'),
    status: 'pending',
    paidAt: null,
    paidBy: null,
  }, { isNewRecord: false });

  const getInstallments = createGetAssociateInstallments({
    clock: () => new Date('2026-07-28T12:00:00.000Z'),
    associateRepository: {
      async findInstallmentsByAssociateId() {
        return [persistedInstallment];
      },
      async findById() {
        return { id: 12, name: 'Socio persistido' };
      },
      async updateInstallmentStatus() {
        return [1];
      },
    },
  });

  const result = await getInstallments({ actor: { id: 1, role: 'admin' }, associateId: 12 });

  assert.equal(result.installments[0].id, 9);
  assert.equal(result.installments[0].installmentNumber, 3);
  assert.equal(result.installments[0].amount, 20000);
  assert.equal(result.installments[0].status, 'overdue');
  assert.equal(result.totals.totalOverdue, 20000);
});

test('createGetAssociateInstallments returns alerts for overdue and upcoming associate payments', async () => {
  const getInstallments = createGetAssociateInstallments({
    clock: () => new Date('2026-05-10T12:00:00.000Z'),
    associateRepository: {
      async findInstallmentsByAssociateId() {
        return [
          { id: 1, installmentNumber: 1, amount: 120, dueDate: new Date('2026-05-08T00:00:00.000Z'), status: 'pending', paidAt: null, paidBy: null, paidByUser: null },
          { id: 2, installmentNumber: 2, amount: 80, dueDate: new Date('2026-05-15T00:00:00.000Z'), status: 'pending', paidAt: null, paidBy: null, paidByUser: null },
          { id: 3, installmentNumber: 3, amount: 70, dueDate: new Date('2026-06-20T00:00:00.000Z'), status: 'pending', paidAt: null, paidBy: null, paidByUser: null },
          { id: 4, installmentNumber: 4, amount: 60, dueDate: new Date('2026-05-05T00:00:00.000Z'), status: 'paid', paidAt: new Date('2026-05-05T00:00:00.000Z'), paidBy: 1, paidByUser: { id: 1, name: 'Admin' } },
        ];
      },
      async findById() {
        return { id: 12, name: 'Partner One' };
      },
    },
  });

  const result = await getInstallments({ actor: { id: 1, role: 'admin' }, associateId: 12 });

  assert.deepEqual(result.alerts.map((alert) => ({
    type: alert.type,
    severity: alert.severity,
    installmentNumber: alert.installmentNumber,
    daysUntilDue: alert.daysUntilDue,
    daysOverdue: alert.daysOverdue,
  })), [
    { type: 'overdue', severity: 'high', installmentNumber: 1, daysUntilDue: null, daysOverdue: 2 },
    { type: 'upcoming', severity: 'medium', installmentNumber: 2, daysUntilDue: 5, daysOverdue: null },
  ]);
});

test('createGetAssociateInstallments rejects socio records before associate lookup', async () => {
  const getInstallments = createGetAssociateInstallments({
    associateRepository: {
      async findInstallmentsByAssociateId() {
        throw new Error('should not be called');
      },
      async findById() {
        throw new Error('findById should not be called for socio records');
      },
    },
  });

  await assert.rejects(() => getInstallments({
    actor: { id: 9, role: 'socio', associateId: 5 },
    associateId: 12,
  }), AuthorizationError);
});

test('createPayAssociateInstallment marks installment as paid with date and method only', async () => {
  const calls = [];
  const payInstallment = createPayAssociateInstallment({
    associateRepository: {
      async findInstallmentsByAssociateId(associateId) {
        return [
          { id: 2, installmentNumber: 2, amount: 100, dueDate: new Date('2026-02-15'), status: 'pending', toJSON: () => ({ id: 2, installmentNumber: 2, amount: 100, dueDate: new Date('2026-02-15'), status: 'pending' }) },
        ];
      },
      async updateInstallmentStatus(associateId, installmentNumber, status, paidAt, paidBy, paymentMethod, notes) {
        calls.push(['updateInstallmentStatus', {
          associateId, installmentNumber, status, paidAt, paidBy, paymentMethod, notes,
        }]);
        assert.equal(associateId, 12);
        assert.equal(installmentNumber, 2);
        assert.equal(status, 'paid');
        assert.equal(paidBy, 1);
        assert.equal(paymentMethod, 'transferencia');
        assert.equal(notes, null);
        return 1;
      },
      async findById() {
        return { id: 12, name: 'Partner One', interestType: 'monthly', interestRate: '2.0000', interestPaymentDay: 15 };
      },
      async listContributionsByAssociate() {
        return [{ amount: 1000 }];
      },
      async createInstallment(payload) {
        calls.push(['createInstallment', payload]);
        return { id: 3, ...payload };
      },
    },
  });

  const result = await payInstallment({
    actor: { id: 1, role: 'admin' },
    associateId: 12,
    installmentNumber: 2,
    payload: {
      paymentDate: '2026-02-16',
      paymentMethod: 'transferencia',
    },
  });

  assert.equal(result.success, true);
  assert.equal(result.installment.status, 'paid');
  assert.equal(result.installment.paymentMethod, 'transferencia');
  assert.equal(calls[0][0], 'updateInstallmentStatus');
  assert.equal(calls[0][1].notes, null);
  assert.equal(calls[1][0], 'createInstallment');
  assert.equal(calls[1][1].installmentNumber, 3);
  assert.equal(calls[1][1].amount, 20);
  assert.equal(calls[1][1].dueDate.toISOString().slice(0, 10), '2026-03-15');
});

test('createPayAssociateInstallment rejects notes and missing payment method', async () => {
  const payInstallment = createPayAssociateInstallment({
    associateRepository: {
      async findInstallmentsByAssociateId() {
        return [
          {
            id: 2,
            installmentNumber: 2,
            amount: 100,
            dueDate: new Date('2026-02-15'),
            status: 'pending',
            toJSON: () => ({ id: 2, installmentNumber: 2, amount: 100, dueDate: new Date('2026-02-15'), status: 'pending' }),
          },
        ];
      },
      async findById() {
        return { id: 12, name: 'Partner One' };
      },
      async updateInstallmentStatus() {
        throw new Error('should not persist installment payment');
      },
    },
  });

  await assert.rejects(() => payInstallment({
    actor: { id: 1, role: 'admin' },
    associateId: 12,
    installmentNumber: 2,
    payload: {
      paymentDate: '2026-02-16',
      paymentMethod: 'transferencia',
      notes: 'legacy note',
    },
  }), (error) => {
    assert.ok(error instanceof ValidationError);
    assert.match(error.message, /fecha real de pago y método de pago/i);
    return true;
  });

  await assert.rejects(() => payInstallment({
    actor: { id: 1, role: 'admin' },
    associateId: 12,
    installmentNumber: 2,
    payload: {
      paymentDate: '2026-02-16',
      paymentMethod: '   ',
    },
  }), (error) => {
    assert.ok(error instanceof ValidationError);
    assert.match(error.message, /método de pago/i);
    return true;
  });
});

test('createPayAssociateInstallment rejects already paid installment', async () => {
  const payInstallment = createPayAssociateInstallment({
    associateRepository: {
      async findInstallmentsByAssociateId() {
        return [
          { id: 1, installmentNumber: 1, amount: 100, status: 'paid' },
        ];
      },
      async findById() {
        return { id: 12, name: 'Partner One' };
      },
    },
  });

  await assert.rejects(() => payInstallment({
    actor: { id: 1, role: 'admin' },
    associateId: 12,
    installmentNumber: 1,
    payload: {},
  }), (error) => {
    assert.ok(error instanceof ValidationError);
    assert.equal(error.message, 'La cuota del socio ya fue pagada');
    return true;
  });
});

test('createPayAssociateInstallment rejects non-existent installment', async () => {
  const payInstallment = createPayAssociateInstallment({
    associateRepository: {
      async findInstallmentsByAssociateId() {
        return [];
      },
      async findById() {
        return { id: 12, name: 'Partner One' };
      },
    },
  });

  await assert.rejects(() => payInstallment({
    actor: { id: 1, role: 'admin' },
    associateId: 12,
    installmentNumber: 999,
    payload: {},
  }), NotFoundError);
});

test('createGetAssociateCalendar aggregates contributions, distributions, and installments', async () => {
  const getCalendar = createGetAssociateCalendar({
    associateRepository: {
      async findCalendarEvents(associateId, startDate, endDate) {
        assert.equal(associateId, 12);
        return {
          contributions: [
            { id: 1, type: 'contribution', amount: 500, date: new Date('2026-01-15'), notes: 'Initial capital', createdBy: { id: 1, name: 'Admin' } },
          ],
          distributions: [
            { id: 2, type: 'distribution', amount: 50, date: new Date('2026-02-01'), notes: 'Profit share', createdBy: { id: 1, name: 'Admin' }, loanId: null, Loan: null },
          ],
          installments: [
            { id: 3, type: 'installment', installmentNumber: 1, amount: 100, dueDate: new Date('2026-03-01'), status: 'pending', paidAt: null },
          ],
        };
      },
      async findById() {
        return { id: 12, name: 'Partner One' };
      },
    },
  });

  const result = await getCalendar({
    actor: { id: 1, role: 'admin' },
    associateId: 12,
    startDate: '2026-01-01',
    endDate: '2026-12-31',
  });

  assert.equal(result.associateId, 12);
  assert.equal(result.events.length, 3);
  assert.equal(result.summary.contributionCount, 1);
  assert.equal(result.summary.distributionCount, 1);
  assert.equal(result.summary.installmentCount, 1);
  assert.equal(result.summary.pendingInstallments, 1);
});

test('createGetAssociateCalendar rejects inverted date ranges before reading calendar events', async () => {
  const getCalendar = createGetAssociateCalendar({
    associateRepository: {
      async findCalendarEvents() {
        throw new Error('calendar events should not be read for an invalid date range');
      },
      async findById() {
        return { id: 12, name: 'Partner One' };
      },
    },
  });

  await assert.rejects(() => getCalendar({
    actor: { id: 1, role: 'admin' },
    associateId: 12,
    startDate: '2026-12-31',
    endDate: '2026-01-01',
  }), /fecha inicial debe ser anterior o igual a la fecha final/i);
});

test('createCreateAssociateContribution rejects inactive associates', async () => {
  const createContribution = createCreateAssociateContribution({
    associateRepository: {
      async findById() {
        return {
          id: 3,
          status: 'inactive',
          interestType: 'monthly',
          interestRate: '2.5000',
          interestPaymentDay: 1,
        };
      },
    },
  });

  await assert.rejects(() => createContribution({
    actor: { id: 1, role: 'admin' },
    associateId: 3,
    payload: { amount: 100000 },
  }), /socio inactivo/i);
});

test('createUpdateAssociate reprojects pending interest installments when scheduling terms change', async () => {
  const calls = [];
  const updateAssociate = createUpdateAssociate({
    associateRepository: {
      async findById() {
        return {
          id: 4,
          status: 'active',
          email: 'socio@test.local',
          phone: '3001234567',
          interestType: 'monthly',
          interestRate: '2.0000',
          interestPaymentDay: 1,
          interestPaymentMonth: null,
        };
      },
      async update(_associate, payload) {
        return { id: 4, status: 'active', ...payload };
      },
      async listContributionsByAssociate() {
        return [{ id: 10, amount: 1000000, contributionDate: '2026-01-01T00:00:00.000Z' }];
      },
      async listProfitDistributionsByAssociate() {
        return [];
      },
      async findInstallmentsByAssociateId() {
        return [{
          id: 20,
          installmentNumber: 1,
          amount: 20000,
          dueDate: '2026-07-15T00:00:00.000Z',
          status: 'pending',
        }];
      },
      async updateInstallmentProjection(installmentId, payload) {
        calls.push(['updateInstallmentProjection', installmentId, payload]);
        return { id: installmentId, ...payload };
      },
      async createInstallment() {
        return null;
      },
    },
  });

  await updateAssociate({
    associateId: 4,
    payload: { interestRate: '3.0000' },
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'updateInstallmentProjection');
  assert.equal(Number(calls[0][2].amount), 30000);
});

test('createGetAssociateCalendar counts overdue installments as pending in summary', async () => {
  const getCalendar = createGetAssociateCalendar({
    associateRepository: {
      async findById() {
        return { id: 12, name: 'Partner One' };
      },
      async findCalendarEvents() {
        return {
          contributions: [],
          distributions: [],
          installments: [
            { id: 1, type: 'installment', amount: 1000, dueDate: new Date('2026-01-01'), status: 'overdue' },
            { id: 2, type: 'installment', amount: 1000, dueDate: new Date('2026-07-01'), status: 'paid' },
          ],
        };
      },
    },
  });

  const result = await getCalendar({
    actor: { id: 1, role: 'admin' },
    associateId: 12,
  });

  assert.equal(result.summary.pendingInstallments, 1);
});
