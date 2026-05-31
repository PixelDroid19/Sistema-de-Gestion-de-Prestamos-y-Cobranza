const { test, mock } = require('node:test');
const assert = require('node:assert/strict');

const { createGetAuditLogs } = require('@/modules/audit/application/useCases');

test('audit log filter validation does not expose raw enum catalogs', async () => {
  const auditService = {
    query: mock.fn(() => Promise.resolve({ items: [], totalItems: 0 })),
  };
  const getAuditLogs = createGetAuditLogs({ auditService });

  await assert.rejects(
    () => getAuditLogs({ filters: { category: 'LOW_LEVEL_INTERNAL' } }),
    (error) => {
      assert.equal(error.name, 'ValidationError');
      assert.equal(error.message, 'Filtro de auditoría inválido.');
      assert.doesNotMatch(error.message, /LOW_LEVEL_INTERNAL|TECHNICAL|BUSINESS|SECURITY|AUDIT/);
      return true;
    },
  );

  assert.equal(auditService.query.mock.callCount(), 0);
});
