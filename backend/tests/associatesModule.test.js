const test = require('node:test');
const assert = require('node:assert/strict');

const { NotFoundError, ValidationError, AuthorizationError } = require('../src/utils/errorHandler');
const {
  createListAssociates,
  createCreateAssociate,
  createGetAssociateById,
  createUpdateAssociate,
  createDeleteAssociate,
  createListAssociatePortalSummary,
  createCreateAssociateContribution,
  createCreateProfitDistribution,
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
  assert.deepEqual(associates, [{ id: 4 }, { id: 3 }]);
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
  });

  assert.equal(associate.id, 12);
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
        return { id, name: 'Partner One' };
      },
      async listContributionsByAssociate() {
        return [{ id: 1, amount: 1000 }];
      },
      async listProfitDistributionsByAssociate() {
        return [{ id: 2, amount: 150 }];
      },
      async listLoansByAssociate() {
        return [{ id: 3, status: 'active', amount: 4000 }];
      },
    },
  });

  const report = await listAssociatePortalSummary({ actor: { id: 9, role: 'socio', associateId: 12 } });

  assert.equal(report.associate.id, 12);
  assert.equal(report.summary.totalContributed, 1000);
  assert.equal(report.summary.totalDistributed, 150);
  assert.equal(report.summary.activeLoanCount, 1);
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
