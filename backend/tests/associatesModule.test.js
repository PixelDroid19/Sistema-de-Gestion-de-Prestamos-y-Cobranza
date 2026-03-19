const test = require('node:test');
const assert = require('node:assert/strict');

const { NotFoundError, ValidationError } = require('../src/utils/errorHandler');
const {
  createListAssociates,
  createCreateAssociate,
  createGetAssociateById,
  createUpdateAssociate,
  createDeleteAssociate,
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
