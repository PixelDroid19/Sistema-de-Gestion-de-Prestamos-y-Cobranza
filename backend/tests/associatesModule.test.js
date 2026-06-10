const test = require('node:test');
const assert = require('node:assert/strict');

const { NotFoundError, ValidationError, AuthorizationError } = require('@/utils/errorHandler');
const {
  allocateProportionalDistribution,
  buildProportionalIdempotencyRequestHash,
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
  createCreateProportionalProfitDistribution,
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
    { id: 4, participationPercentage: null, interestType: 'monthly', interestRate: '0.0000', interestPaymentDay: 1, interestPaymentMonth: null },
    { id: 3, participationPercentage: null, interestType: 'monthly', interestRate: '0.0000', interestPaymentDay: 1, interestPaymentMonth: null },
  ]);
});

test('createListAssociates preserves pagination metadata with normalized associate rows', async () => {
  const listAssociates = createListAssociates({
    associateRepository: {
      async listPage() {
        return {
          items: [{ id: 4, participationPercentage: '25.0000' }, { id: 3, participationPercentage: null }],
          pagination: { page: 2, pageSize: 5, totalItems: 7, totalPages: 2 },
        };
      },
    },
  });

  const result = await listAssociates({ pagination: { page: 2, pageSize: 5 } });

  assert.deepEqual(result, {
    items: [
      { id: 4, participationPercentage: '25.0000', interestType: 'monthly', interestRate: '0.0000', interestPaymentDay: 1, interestPaymentMonth: null },
      { id: 3, participationPercentage: null, interestType: 'monthly', interestRate: '0.0000', interestPaymentDay: 1, interestPaymentMonth: null },
    ],
    pagination: { page: 2, pageSize: 5, totalItems: 7, totalPages: 2 },
  });
});

test('createListAssociates forwards normalized search and status filters to the repository', async () => {
  let forwardedFilters = null;
  const listAssociates = createListAssociates({
    associateRepository: {
      async listPage({ filters }) {
        forwardedFilters = filters;
        return {
          items: [{ id: 9, participationPercentage: null }],
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

test('createCreateAssociate delegates persistence to the repository', async () => {
  const createAssociate = createCreateAssociate({
    associateRepository: {
      async findConflictingContact() {
        return null;
      },
      async create(payload) {
        return { id: 12, ...payload };
      },
    },
  });

  const associate = await createAssociate({
    actor: { id: 1, role: 'admin' },
    payload: {
      name: 'New Associate',
      email: 'associate@example.com',
      phone: '+573001112255',
      participationPercentage: '25',
    },
  });

  assert.equal(associate.id, 12);
  assert.equal(associate.participationPercentage, '25.0000');
});

test('createCreateAssociate records initial capital and schedules the first monthly interest payment', async () => {
  const calls = [];
  const createAssociate = createCreateAssociate({
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
      interestStartDate: '2026-05-02',
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
  assert.equal(calls[2][0], 'createInstallment');
  assert.equal(calls[2][1].amount, 50000);
  assert.equal(calls[2][1].capitalBase, 2000000);
  assert.equal(calls[2][1].interestType, 'monthly');
  assert.equal(calls[2][1].interestRate, '2.5000');
  assert.equal(calls[2][1].dueDate.toISOString().slice(0, 10), '2026-05-15');
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
      interestStartDate: '2026-05-02',
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
      name: 'Bad Date',
      email: 'bad.date@example.com',
      phone: '+573001112247',
      interestType: 'monthly',
      interestRate: 2,
      interestStartDate: '60517-02-14',
    },
  }), (error) => {
    assert.ok(error instanceof ValidationError);
    assert.equal(error.message, 'La fecha de inicio de intereses debe tener formato AAAA-MM-DD');
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
        return { id, name: 'Partner One', participationPercentage: '25.0000', interestType: 'monthly', interestRate: '2.0000' };
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
            basis: {
              type: 'proportional-participation',
              sourceAmount: '600.00',
              allocatedAmount: '150.00',
              participationPercentage: '25.0000',
            },
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
  assert.equal(report.associate.participationPercentage, '25.0000');
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
  assert.equal(report.paymentHistory[0].displayType, 'Pago proporcional de rentabilidad');
  assert.equal(report.paymentHistory[0].paidByUser.name, 'Operador Socios');
  assert.equal(report.paymentHistory[1].displayType, 'Pago programado #1');
  assert.equal(report.paymentHistory[2].displayType, 'Devolución de capital');
  assert.equal(report.distributions[0].distributionType, 'proportional');
  assert.equal(report.distributions[1].distributionType, 'capital_return');
  assert.equal(report.capitalReturns.length, 1);
  assert.equal(Object.hasOwn(report, 'loans'), false);
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
              participationPercentage: '50.0000',
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

test('associate reinvestment and proportional distribution reject non-admin actors with operator-facing messages', async () => {
  const createAssociateReinvestment = createCreateAssociateReinvestment({
    associateRepository: {
      async findById() {
        throw new Error('findById should not be called');
      },
    },
  });
  const createProportionalProfitDistribution = createCreateProportionalProfitDistribution({
    associateRepository: {
      async listActive() {
        throw new Error('listActive should not be called');
      },
    },
  });

  await assert.rejects(() => createAssociateReinvestment({
    actor: { id: 9, role: 'socio', associateId: 12 },
    associateId: 12,
    payload: { amount: 50 },
  }), (error) => {
    assert.ok(error instanceof AuthorizationError);
    assert.equal(error.message, 'Solo usuarios administrativos autorizados pueden registrar reinversiones de socios.');
    return true;
  });

  await assert.rejects(() => createProportionalProfitDistribution({
    actor: { id: 9, role: 'socio', associateId: 12 },
    idempotencyKey: 'dist-prop-1',
    payload: { amount: 50 },
  }), (error) => {
    assert.ok(error instanceof AuthorizationError);
    assert.equal(error.message, 'Solo usuarios administrativos autorizados pueden registrar distribuciones proporcionales.');
    return true;
  });
});

test('createCreateAssociateReinvestment records paired distribution and contribution entries', async () => {
  const calls = [];
  const createAssociateReinvestment = createCreateAssociateReinvestment({
    associateRepository: {
      async findById() {
        return { id: 12, name: 'Partner One', participationPercentage: '25.0000' };
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
  assert.equal(calls.length, 2);
});

test('allocateProportionalDistribution assigns remainder deterministically by highest fractional remainder then associate id', () => {
  const allocations = allocateProportionalDistribution({
    amountCents: 100,
    associates: [
      { id: 1, participationUnits: 333300, participationPercentage: '33.3300' },
      { id: 2, participationUnits: 333300, participationPercentage: '33.3300' },
      { id: 3, participationUnits: 333400, participationPercentage: '33.3400' },
    ],
  });

  assert.deepEqual(allocations.map((entry) => ({ id: entry.associate.id, amountCents: entry.amountCents, roundingAdjustmentCents: entry.roundingAdjustmentCents })), [
    { id: 1, amountCents: 33, roundingAdjustmentCents: 0 },
    { id: 2, amountCents: 33, roundingAdjustmentCents: 0 },
    { id: 3, amountCents: 34, roundingAdjustmentCents: 1 },
  ]);
});

test('createCreateProportionalProfitDistribution rejects missing active associates', async () => {
  const createProportionalProfitDistribution = createCreateProportionalProfitDistribution({
    associateRepository: {
      async listActiveAssociatesWithParticipation() {
        return [];
      },
    },
  });

  await assert.rejects(() => createProportionalProfitDistribution({
    actor: { id: 1, role: 'admin' },
    payload: { amount: '100.00' },
  }), (error) => {
    assert.ok(error instanceof ValidationError);
    assert.equal(error.message, 'Debe existir al menos un socio activo para distribuir utilidades.');
    return true;
  });
});

test('createCreateProportionalProfitDistribution rejects missing or non-positive active participation percentages', async () => {
  const createProportionalProfitDistribution = createCreateProportionalProfitDistribution({
    associateRepository: {
      async listActiveAssociatesWithParticipation() {
        return [
          { id: 4, participationPercentage: null },
          { id: 8, participationPercentage: '0.0000' },
        ];
      },
    },
  });

  await assert.rejects(() => createProportionalProfitDistribution({
    actor: { id: 1, role: 'admin' },
    payload: { amount: '100.00' },
  }), (error) => {
    assert.ok(error instanceof ValidationError);
    assert.equal(error.message, 'Completa la participación de los socios activos antes de distribuir utilidades.');
    assert.deepEqual(error.errors, [
      {
        field: 'participationPercentage',
        message: 'Completa el porcentaje de participación de todos los socios activos.',
      },
      {
        field: 'participationPercentage',
        message: 'Los porcentajes de participación de socios activos deben ser mayores que cero.',
      },
    ]);
    return true;
  });
});

test('createCreateProportionalProfitDistribution rejects pools that do not total exactly 100 percent', async () => {
  const createProportionalProfitDistribution = createCreateProportionalProfitDistribution({
    associateRepository: {
      async listActiveAssociatesWithParticipation() {
        return [
          { id: 1, participationPercentage: '60.0000' },
          { id: 2, participationPercentage: '39.9999' },
        ];
      },
    },
  });

  await assert.rejects(() => createProportionalProfitDistribution({
    actor: { id: 1, role: 'admin' },
    payload: { amount: '100.00' },
  }), (error) => {
    assert.ok(error instanceof ValidationError);
    assert.equal(error.message, 'La participación activa de socios debe sumar exactamente 100%.');
    return true;
  });
});

test('createCreateProportionalProfitDistribution creates deterministic transactional batch output', async () => {
  const batchPayloads = [];
  const createProportionalProfitDistribution = createCreateProportionalProfitDistribution({
    associateRepository: {
      async listActiveAssociatesWithParticipation() {
        return [
          { id: 1, participationPercentage: '33.3300' },
          { id: 2, participationPercentage: '33.3300' },
          { id: 3, participationPercentage: '33.3400' },
        ];
      },
      async createProfitDistributionBatch(payloads) {
        batchPayloads.push(...payloads);
        return payloads.map((payload, index) => ({ id: index + 1, ...payload }));
      },
    },
  });

  const result = await createProportionalProfitDistribution({
    actor: { id: 7, role: 'admin' },
    payload: {
      amount: '1.00',
      distributionDate: '2026-03-19T00:00:00.000Z',
      notes: 'Monthly distribution',
      basis: { source: 'statement-2026-03' },
    },
  });

  assert.equal(result.declaredAmount, '1.00');
  assert.equal(result.totalAllocatedAmount, '1.00');
  assert.equal(result.eligibleAssociateCount, 3);
  assert.equal(result.idempotencyStatus, 'created');
  assert.equal(result.idempotencyKey, null);
  assert.match(result.batchKey, /^assoc-proportional:7:/);
  assert.deepEqual(batchPayloads.map((entry) => ({
    associateId: entry.associateId,
    amount: entry.amount,
    roundingAdjustment: entry.basis.roundingAdjustment,
    allocatedAmount: entry.basis.allocatedAmount,
    participationPercentage: entry.basis.participationPercentage,
    type: entry.basis.type,
    source: entry.basis.source,
  })), [
    { associateId: 1, amount: 0.33, roundingAdjustment: '0.00', allocatedAmount: '0.33', participationPercentage: '33.3300', type: 'proportional-participation', source: 'statement-2026-03' },
    { associateId: 2, amount: 0.33, roundingAdjustment: '0.00', allocatedAmount: '0.33', participationPercentage: '33.3300', type: 'proportional-participation', source: 'statement-2026-03' },
    { associateId: 3, amount: 0.34, roundingAdjustment: '0.01', allocatedAmount: '0.34', participationPercentage: '33.3400', type: 'proportional-participation', source: 'statement-2026-03' },
  ]);
  assert.equal(result.createdRows[2].distributionType, 'proportional');
  assert.equal(result.createdRows[2].declaredProportionalTotal, '1.00');
  assert.equal(batchPayloads[0].basis.idempotencyKey, null);
});

test('createCreateProportionalProfitDistribution replays an exact retry with the same idempotency key', async () => {
  const actor = { id: 7, role: 'admin' };
  const payload = {
    amount: '1.00',
    distributionDate: '2026-03-19T00:00:00.000Z',
    notes: 'Monthly distribution',
    basis: { source: 'statement-2026-03', reference: 'abc' },
  };
  const idempotencyKey = 'assoc-proportional-2026-03-19';
  const idempotencyRecords = new Map();
  const batchPayloads = [];
  const findRecord = (transactionLookup) => transactionLookup.get(`${actor.id}:${idempotencyKey}`) || null;
  const createProportionalProfitDistribution = createCreateProportionalProfitDistribution({
    associateRepository: {
      async runInTransaction(work) {
        return work(idempotencyRecords);
      },
      async findProportionalDistributionIdempotency({ actorId, idempotencyKey: lookupKey, transaction }) {
        return (transaction || idempotencyRecords).get(`${actorId}:${lookupKey}`) || null;
      },
      async createProportionalDistributionIdempotency(payloadToPersist, { transaction }) {
        const record = { ...payloadToPersist };
        record.update = async (updates) => {
          Object.assign(record, updates);
          return record;
        };
        (transaction || idempotencyRecords).set(`${payloadToPersist.actorId}:${payloadToPersist.idempotencyKey}`, record);
        return record;
      },
      async updateProportionalDistributionIdempotency(record, updates) {
        Object.assign(record, updates);
        return record;
      },
      async listActiveAssociatesWithParticipation() {
        return [
          { id: 1, participationPercentage: '50.0000' },
          { id: 2, participationPercentage: '50.0000' },
        ];
      },
      async createProfitDistributionBatch(payloads) {
        batchPayloads.push(...payloads);
        return payloads.map((entry, index) => ({ id: index + 1, ...entry }));
      },
    },
  });

  const firstResult = await createProportionalProfitDistribution({ actor, idempotencyKey, payload });
  const replayResult = await createProportionalProfitDistribution({ actor, idempotencyKey, payload: { ...payload, basis: { reference: 'abc', source: 'statement-2026-03' } } });

  assert.equal(firstResult.idempotencyStatus, 'created');
  assert.equal(replayResult.idempotencyStatus, 'replayed');
  assert.deepEqual(replayResult.createdRows, firstResult.createdRows);
  assert.equal(batchPayloads.length, 2);
  assert.equal(batchPayloads[0].basis.idempotencyKey, idempotencyKey);
  assert.equal(findRecord(idempotencyRecords).status, 'completed');
});

test('createCreateProportionalProfitDistribution rejects a reused idempotency key with a mismatched payload', async () => {
  const actor = { id: 7, role: 'admin' };
  const idempotencyKey = 'assoc-proportional-2026-03-19';
  const originalPayload = {
    amount: '100.00',
    distributionDate: '2026-03-19T00:00:00.000Z',
    notes: 'Monthly distribution',
    basis: { source: 'statement-2026-03' },
  };
  const existingRecord = {
    requestHash: buildProportionalIdempotencyRequestHash({
      amount: '100.00',
      basis: { source: 'statement-2026-03' },
      distributionDate: '2026-03-19T00:00:00.000Z',
      notes: 'Monthly distribution',
    }),
    status: 'completed',
    responsePayload: { batchKey: 'batch-1', declaredAmount: '100.00', createdRows: [] },
  };
  const createProportionalProfitDistribution = createCreateProportionalProfitDistribution({
    associateRepository: {
      async findProportionalDistributionIdempotency() {
        return existingRecord;
      },
      async runInTransaction() {
        throw new Error('runInTransaction should not be called');
      },
    },
  });

  await assert.rejects(() => createProportionalProfitDistribution({
    actor,
    idempotencyKey,
    payload: { ...originalPayload, amount: '101.00' },
  }), (error) => {
    assert.equal(error.name, 'ConflictError');
    assert.equal(error.statusCode, 409);
    assert.equal(error.message, 'Esta distribución proporcional ya fue enviada con otros datos. Revisa el resultado antes de intentar nuevamente.');
    assert.equal(error.errors[0].field, 'idempotencyKey');
    assert.equal(error.errors[0].message, 'Esta distribución proporcional ya fue enviada con otros datos. Revisa el resultado antes de intentar nuevamente.');
    return true;
  });
});

test('createCreateProportionalProfitDistribution prevents a near-concurrent duplicate submission when the key is already pending', async () => {
  const actor = { id: 7, role: 'admin' };
  const idempotencyKey = 'assoc-proportional-2026-03-19';
  const payload = {
    amount: '100.00',
    distributionDate: '2026-03-19T00:00:00.000Z',
    notes: 'Monthly distribution',
    basis: { source: 'statement-2026-03' },
  };
  const requestHash = buildProportionalIdempotencyRequestHash({
    amount: '100.00',
    basis: { source: 'statement-2026-03' },
    distributionDate: '2026-03-19T00:00:00.000Z',
    notes: 'Monthly distribution',
  });
  const createProportionalProfitDistribution = createCreateProportionalProfitDistribution({
    associateRepository: {
      async findProportionalDistributionIdempotency() {
        return {
          requestHash,
          status: 'pending',
          responsePayload: {},
        };
      },
      async runInTransaction() {
        throw new Error('runInTransaction should not be called');
      },
    },
  });

  await assert.rejects(() => createProportionalProfitDistribution({
    actor,
    idempotencyKey,
    payload,
  }), (error) => {
    assert.equal(error.name, 'ConflictError');
    assert.equal(error.statusCode, 409);
    assert.equal(error.message, 'Esta distribución proporcional ya se está procesando. Espera el resultado antes de intentar nuevamente.');
    assert.equal(error.errors[0].message, 'Esta distribución proporcional ya se está procesando. Espera el resultado antes de intentar nuevamente.');
    return true;
  });
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

test('createGetAssociateInstallments returns alerts for overdue and upcoming associate payments', async () => {
  const getInstallments = createGetAssociateInstallments({
    clock: () => new Date('2026-05-10T00:00:00.000Z'),
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

test('createPayAssociateInstallment marks installment as paid', async () => {
  const calls = [];
  const payInstallment = createPayAssociateInstallment({
    associateRepository: {
      async findInstallmentsByAssociateId(associateId) {
        return [
          { id: 2, installmentNumber: 2, amount: 100, dueDate: new Date('2026-02-15'), status: 'pending', toJSON: () => ({ id: 2, installmentNumber: 2, amount: 100, dueDate: new Date('2026-02-15'), status: 'pending' }) },
        ];
      },
      async updateInstallmentStatus(associateId, installmentNumber, status, paidAt, paidBy) {
        calls.push(['updateInstallmentStatus', { associateId, installmentNumber, status, paidAt, paidBy }]);
        assert.equal(associateId, 12);
        assert.equal(installmentNumber, 2);
        assert.equal(status, 'paid');
        assert.equal(paidBy, 1);
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
    payload: {},
  });

  assert.equal(result.success, true);
  assert.equal(result.installment.status, 'paid');
  assert.equal(calls[1][0], 'createInstallment');
  assert.equal(calls[1][1].installmentNumber, 3);
  assert.equal(calls[1][1].amount, 20);
  assert.equal(calls[1][1].dueDate.toISOString().slice(0, 10), '2026-03-15');
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
