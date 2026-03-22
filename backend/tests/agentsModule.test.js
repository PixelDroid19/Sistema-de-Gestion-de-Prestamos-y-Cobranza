const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createListAgents,
  createCreateAgent,
} = require('../src/modules/agents/application/useCases');

test('createListAgents returns repository results in name order', async () => {
  const listAgents = createListAgents({
    agentRepository: {
      async list() {
        return [{ id: 2, name: 'Ana Agent' }, { id: 3, name: 'Luis Agent' }];
      },
    },
  });

  const agents = await listAgents();
  assert.deepEqual(agents, [{ id: 2, name: 'Ana Agent' }, { id: 3, name: 'Luis Agent' }]);
});

test('createListAgents preserves repository pagination results', async () => {
  const listAgents = createListAgents({
    agentRepository: {
      async listPage() {
        return {
          items: [{ id: 2, name: 'Ana Agent' }, { id: 3, name: 'Luis Agent' }],
          pagination: { page: 3, pageSize: 2, totalItems: 8, totalPages: 4 },
        };
      },
    },
  });

  const result = await listAgents({ pagination: { page: 3, pageSize: 2 } });

  assert.deepEqual(result, {
    items: [{ id: 2, name: 'Ana Agent' }, { id: 3, name: 'Luis Agent' }],
    pagination: { page: 3, pageSize: 2, totalItems: 8, totalPages: 4 },
  });
});

test('createCreateAgent delegates persistence to the repository', async () => {
  const createAgent = createCreateAgent({
    agentRepository: {
      async create(payload) {
        return { id: 10, ...payload };
      },
    },
  });

  const agent = await createAgent({
    name: 'New Agent',
    email: 'agent@example.com',
    phone: '+573001112244',
  });

  assert.equal(agent.id, 10);
  assert.equal(agent.email, 'agent@example.com');
});
