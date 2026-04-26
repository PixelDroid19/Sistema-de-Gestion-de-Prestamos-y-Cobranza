const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const backendRoot = path.join(__dirname, '..');

const readBackendFile = (relativePath) => fs.readFileSync(path.join(backendRoot, relativePath), 'utf8');

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const hasJsdocForConst = (source, symbolName) => new RegExp(`/\\*\\*[\\s\\S]*?\\*/\\s*const ${escapeRegExp(symbolName)}\\s*=`, 'm').test(source);

const selectedPublicSeams = [
  ['src/app.js', 'createApp'],
  ['src/server.js', 'startServer'],
  ['src/bootstrap/index.js', 'validateEnvironment'],
  ['src/bootstrap/index.js', 'bootstrap'],
  ['src/modules/index.js', 'buildModuleRegistry'],
  ['src/modules/shared/http.js', 'respond'],
  ['src/modules/shared/http.js', 'success'],
  ['src/modules/shared/http.js', 'created'],
  ['src/modules/credits/public.js', 'createCreditsPublicPorts'],
  ['src/modules/shared/auth.js', 'createAuthMiddleware'],
  ['src/modules/shared/auth/tokenService.js', 'createJwtTokenService'],
];

test('selected exported backend seams keep explicit JSDoc contracts', () => {
  selectedPublicSeams.forEach(([relativePath, symbolName]) => {
    const source = readBackendFile(relativePath);
    assert.equal(
      hasJsdocForConst(source, symbolName),
      true,
      `${relativePath} should document ${symbolName} with JSDoc`,
    );
  });
});

test('documentation stays selective for non-obvious helpers only', () => {
  const documentedHelpers = [
    ['src/modules/credits/application/loanFinancials.js', 'buildFinancialSnapshot'],
    ['src/modules/credits/application/loanFinancials.js', 'getCanonicalLoanView'],
    ['src/modules/credits/application/loanFinancials.js', 'createLoanViewService'],
    ['src/modules/credits/application/creditPolicyResolver.js', 'createCreditPolicyResolver'],
    ['src/modules/credits/application/recoveryStatusGuard.js', 'createRecoveryStatusGuard'],
    ['src/modules/reports/application/useCases.js', 'buildLoanReportRecord'],
    ['src/docs/openapi.js', 'buildOpenApiDocument'],
  ];

  documentedHelpers.forEach(([relativePath, symbolName]) => {
    const source = readBackendFile(relativePath);
    assert.equal(
      hasJsdocForConst(source, symbolName),
      true,
      `${relativePath} should document non-obvious helper ${symbolName}`,
    );
  });

  const intentionallyUndocumentedHelpers = [
    ['src/modules/shared/loanAccessPolicy.js', 'normalizeId'],
    ['src/modules/shared/auth.js', 'normalizeRoles'],
    ['src/modules/auth/application/useCases.js', 'sanitizeUser'],
  ];

  intentionallyUndocumentedHelpers.forEach(([relativePath, symbolName]) => {
    const source = readBackendFile(relativePath);
    assert.equal(
      hasJsdocForConst(source, symbolName),
      false,
      `${relativePath} should leave trivial helper ${symbolName} undocumented`,
    );
  });
});

test('comment cleanup removes known redundant backend narration without broad lint rules', () => {
  const validationSource = readBackendFile('src/middleware/validation.js');
  const removedComments = [
    '// Generic validation function',
    '// Custom validation functions',
    '// Validation schemas (using simple validation for now, can be replaced with Joi)',
    '// Max 30 years',
  ];

  removedComments.forEach((commentText) => {
    assert.equal(
      validationSource.includes(commentText),
      false,
      `validation.js should not contain redundant comment: ${commentText}`,
    );
  });

  const scopedFilesWithoutLineNarration = [
    'src/bootstrap/index.js',
    'src/middleware/auth.js',
    'src/modules/shared/http.js',
    'src/modules/credits/application/loanFinancials.js',
  ];

  const lineCommentPattern = /^\s*\/\/(?!\/)/m;

  scopedFilesWithoutLineNarration.forEach((relativePath) => {
    const source = readBackendFile(relativePath);
    assert.equal(
      lineCommentPattern.test(source),
      false,
      `${relativePath} should not reintroduce redundant line-comment narration`,
    );
  });
});
