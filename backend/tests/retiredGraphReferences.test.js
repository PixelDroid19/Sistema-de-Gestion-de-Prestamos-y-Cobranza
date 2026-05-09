const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

test('retired graph implementation names do not reappear in runtime code or tests', () => {
  const repoRoot = path.resolve(__dirname, '..', '..');
  const forbiddenPattern = [
    ['Dag', 'GraphVersion'].join(''),
    ['dag', 'GraphVersionId'].join(''),
    ['dag', 'Graph'].join(''),
    ['D', 'A', 'G'].join(''),
    ['application', 'dag'].join('/'),
    ['core', 'domain', 'calculation'].join('/'),
    ['data', 'simulation'].join('\\.'),
  ].join('|');

  const result = spawnSync('rg', [
    '-n',
    forbiddenPattern,
    'backend/src',
    'frontend/src',
    'backend/tests',
    'frontend/src/components/__tests__',
    '--glob',
    '!backend/src/db/migrations/**',
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
  });

  assert.equal(result.status, 1, result.stdout || result.stderr);
});
