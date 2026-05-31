const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const {
  ROOT,
  convertRequire,
} = require('../scripts/migrateToAlias');

test('migrateToAlias converts parent traversal requires inside src to module aliases', () => {
  const sourceFile = path.join(ROOT, 'src/modules/credits/application/useCases.js');

  assert.equal(convertRequire(sourceFile, '../shared/auth'), '@/modules/credits/shared/auth');
});

test('migrateToAlias leaves same-directory and non-src requires untouched', () => {
  const sourceFile = path.join(ROOT, 'src/modules/credits/application/useCases.js');

  assert.equal(convertRequire(sourceFile, './router'), null);
  assert.equal(convertRequire(sourceFile, '../../../../package.json'), null);
});
