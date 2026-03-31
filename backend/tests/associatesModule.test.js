const test = require('node:test');
const assert = require('node:assert/strict');

const { NotFoundError, ValidationError, AuthorizationError } = require('../src/utils/errorHandler');
const {
  allocateProportionalDistribution,
  buildProportionalIdempotencyRequestHash,
  createListAssociates,
  createCreateAssociate,
  createGetAssociateById,
  createUpdateAssociate,
  createDeleteAssociate,
  createListAssociatePortalSummary,
  createCreateAssociateContribution,
  createCreateProfitDistribution,
  createCreateAssociateReinvestment,
  createCreateProportionalProfitDistribution,
  createGetAssociateInstallments,
  createPayAssociateInstallment,
  createGetAssociateCalendar,
} = require('../src/modules/associates/application/useCases');

test('createListAssociates returns repository results in name order', async () => {
  const listAssociates = createListAssociates({
    associateRepository: {
      async list() {
        return [{ id: 4 }, { id: 3 }];
      },
    },
  });

  const associates = await listAssociates();
  assert.deepEqual(associates, [{ id: 4, participationPercentage: null }, { id: 3, participationPercentage: null }]);
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
    items: [{ id: 4, participationPercentage: '25.0000' }, { id: 3, participationPercentage: null }],
    pagination: { page: 2, pageSize: 5, totalItems: 7, totalPages: 2 },
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
    assert.equal(error.message, 'Associate not found');
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

  const updatedAssociate = await updateAssociate(2, { name: 'After Update' });
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

  await assert.rejects(() => deleteAssociate(91), (error) => {
    assert.ok(error instanceof NotFoundError);
    return true;
  });
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
    name: 'New Associate',
    email: 'associate@example.com',
    phone: '+573001112255',
    participationPercentage: '25',
  });

  assert.equal(associate.id, 12);
  assert.equal(associate.participationPercentage, '25.0000');
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
    name: 'New Associate',
    email: 'associate@example.com',
    phone: '+573001112255',
  }), (error) => {
    assert.ok(error instanceof ValidationError);
    assert.deepEqual(error.errors, [
      { field: 'email', message: 'Associate email already exists' },
      { field: 'phone', message: 'Associate phone already exists' },
    ]);
    return true;
  });
});

test('createListAssociatePortalSummary scopes socio access and aggregates profitability totals', async () => {
  const listAssociatePortalSummary = createListAssociatePortalSummary({
    associateRepository: {
      async findById(id) {
        return { id, name: 'Partner One', participationPercentage: '25.0000' };
      },
      async listContributionsByAssociate() {
        return [{ id: 1, amount: 1000 }];
      },
      async listProfitDistributionsByAssociate() {
        return [{ id: 2, amount: 150, basis: { type: 'proportional-participation', sourceAmount: '600.00', allocatedAmount: '150.00', participationPercentage: '25.0000' } }];
      },
      async listLoansByAssociate() {
        return [{ id: 3, status: 'active', amount: 4000 }];
      },
    },
  });

  const report = await listAssociatePortalSummary({ actor: { id: 9, role: 'socio', associateId: 12 } });

  assert.equal(report.associate.id, 12);
  assert.equal(report.associate.participationPercentage, '25.0000');
  assert.equal(report.summary.totalContributed, 1000);
  assert.equal(report.summary.totalDistributed, 150);
  assert.equal(report.summary.activeLoanCount, 1);
  assert.equal(report.distributions[0].distributionType, 'proportional');
});

test('createCreateAssociateContribution validates positive amounts', async () => {
  const createAssociateContribution = createCreateAssociateContribution({
    associateRepository: {
      async findById() {
        return { id: 12 };
      },
      async createContribution(payload) {
        return { id: 4, ...payload };
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
  }), AuthorizationError);
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
    assert.equal(error.message, 'At least one active associate is required for proportional distributions');
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
    assert.equal(error.message, 'Eligible associate participation is incomplete');
    assert.deepEqual(error.errors, [
      {
        field: 'participationPercentage',
        message: 'Active associate 4 must define participationPercentage before proportional distributions',
      },
      {
        field: 'participationPercentage',
        message: 'Active associate 8 must have participationPercentage greater than 0 for proportional distributions',
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
    assert.equal(error.message, 'Active associate participation percentages must total exactly 100.0000');
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
    assert.equal(error.errors[0].field, 'idempotencyKey');
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
    assert.match(error.message, /already being processed/);
    return true;
  });
});

test('createGetAssociateInstallments returns installments with totals', async () => {
  const getInstallments = createGetAssociateInstallments({
    associateRepository: {
      async findInstallmentsByAssociateId(associateId) {
        return [
          { id: 1, installmentNumber: 1, amount: 100, dueDate: new Date('2026-01-01'), status: 'paid', paidAt: new Date('2026-01-15'), paidBy: 1, paidByUser: { id: 1, name: 'Admin' } },
          { id: 2, installmentNumber: 2, amount: 100, dueDate: new Date('2026-02-01'), status: 'pending', paidAt: null, paidBy: null, paidByUser: null },
          { id: 3, installmentNumber: 3, amount: 100, dueDate: new Date('2026-03-01'), status: 'pending', paidAt: null, paidBy: null, paidByUser: null },
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

test('createGetAssociateInstallments rejects unauthorized socio accessing another associate', async () => {
  const getInstallments = createGetAssociateInstallments({
    associateRepository: {
      async findInstallmentsByAssociateId() {
        throw new Error('should not be called');
      },
      async findById() {
        return { id: 5, name: 'Partner One' };
      },
    },
  });

  await assert.rejects(() => getInstallments({
    actor: { id: 9, role: 'socio', associateId: 5 },
    associateId: 12,
  }), AuthorizationError);
});

test('createPayAssociateInstallment marks installment as paid', async () => {
  const payInstallment = createPayAssociateInstallment({
    associateRepository: {
      async findInstallmentsByAssociateId(associateId) {
        return [
          { id: 2, installmentNumber: 2, amount: 100, dueDate: new Date(), status: 'pending', toJSON: () => ({ id: 2, installmentNumber: 2, amount: 100, dueDate: new Date(), status: 'pending' }) },
        ];
      },
      async updateInstallmentStatus(associateId, installmentNumber, status, paidAt, paidBy) {
        assert.equal(associateId, 12);
        assert.equal(installmentNumber, 2);
        assert.equal(status, 'paid');
        assert.equal(paidBy, 1);
        return 1;
      },
      async findById() {
        return { id: 12, name: 'Partner One' };
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
    assert.equal(error.message, 'Installment already paid');
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
