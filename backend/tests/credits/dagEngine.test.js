const test = require('node:test');
const assert = require('node:assert/strict');

const { createCreditsCalculationService } = require('@/modules/credits/application/dag/calculationAdapter');

test('createCreditsCalculationService returns DAG result and graphVersionId', async () => {
  const dagResult = {
    lateFeeMode: 'NONE',
    summary: { installmentAmount: 100, totalPayable: 200, outstandingBalance: 200 },
    schedule: [{ installmentNumber: 1, scheduledPayment: 100, principalComponent: 90, interestComponent: 10, remainingBalance: 100, remainingPrincipal: 90, remainingInterest: 10 }],
  };

  const service = createCreditsCalculationService({
    graphExecutor: { execute: async () => ({ ok: true, source: 'persisted_graph', graphVersionId: 1, result: dagResult }) },
  });

  const execution = await service.calculate({ amount: 100 });

  assert.equal(execution.result, dagResult);
  assert.equal(execution.graphVersionId, 1);
});

test('createCreditsCalculationService propagates DAG execution errors', async () => {
  const service = createCreditsCalculationService({
    graphExecutor: { execute: async () => { throw new Error('dag exploded'); } },
  });

  await assert.rejects(
    () => service.calculate({ amount: 100 }),
    (err) => {
      assert.equal(err.message, 'dag exploded');
      return true;
    },
  );
});

test('createCreditsCalculationService injects one shared startDate when callers omit it', async () => {
  const service = createCreditsCalculationService({
    graphExecutor: {
      execute: async ({ contractVars }) => ({
        ok: true,
        source: 'persisted_graph',
        graphVersionId: 1,
        result: {
          summary: { installmentAmount: 100, totalPayable: 100, outstandingBalance: 100 },
          schedule: [{
            installmentNumber: 1,
            dueDate: contractVars.startDate,
            scheduledPayment: 100,
            principalComponent: 90,
            interestComponent: 10,
            remainingBalance: 0,
            remainingPrincipal: 90,
            remainingInterest: 10,
          }],
        },
      }),
    },
  });

  const execution = await service.calculate({ amount: 100, interestRate: 12, termMonths: 1 });

  assert.equal(execution.graphVersionId, 1);
  assert.match(execution.result.schedule[0].dueDate, /^\d{4}-\d{2}-\d{2}T/);
});
