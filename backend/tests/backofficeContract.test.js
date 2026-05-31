const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const { permissionsCatalog } = require('../src/db/seeds/permissions_catalog');

const runtimeFiles = [
  'src/modules/credits/application/useCases.js',
  'src/modules/credits/presentation/paymentRouter.js',
  'src/modules/credits/infrastructure/repositories.js',
  'src/modules/payouts/application/useCases.js',
  'src/modules/customers/application/useCases.js',
].map((relativePath) => path.join(repoRoot, relativePath));

const supportScript = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

test('administrative runtime code keeps customer and socio records out of login-role branches', () => {
  const forbiddenPatterns = [
    /actor(?:Role)?\s*===\s*['"]customer['"]/,
    /actor(?:Role)?\s*===\s*['"]socio['"]/,
    /customer self-service/i,
    /You can only (?:view|create|access) your own/i,
    /linked to your associate account/i,
  ];

  for (const filePath of runtimeFiles) {
    const source = fs.readFileSync(filePath, 'utf8');
    for (const pattern of forbiddenPatterns) {
      assert.equal(
        pattern.test(source),
        false,
        `${path.relative(repoRoot, filePath)} still contains a retired customer/socio login-role branch (${pattern}).`,
      );
    }
  }
});

test('role-permission schema is scoped to administrative login roles', () => {
  const migrationSource = fs.readFileSync(
    path.join(repoRoot, 'src/db/migrations/20260328_add_granular_permissions.js'),
    'utf8',
  );
  const modelSource = fs.readFileSync(path.join(repoRoot, 'src/models/RolePermission.js'), 'utf8');
  const schemaSource = fs.readFileSync(path.join(repoRoot, 'src/bootstrap/schema.js'), 'utf8');

  assert.match(migrationSource, /DataTypes\.ENUM\('admin', 'employee'\)/);
  assert.doesNotMatch(migrationSource, /DataTypes\.ENUM\('admin', 'customer', 'socio'\)/);
  assert.match(modelSource, /ADMINISTRATIVE_LOGIN_ROLES/);
  assert.doesNotMatch(modelSource, /APPLICATION_ROLES/);
  assert.match(schemaSource, /enumTypeName: 'enum_RolePermissions_role'[\s\S]*values: ADMINISTRATIVE_LOGIN_ROLES/);
  assert.doesNotMatch(schemaSource, /customer:\s*\[\]/);
  assert.doesNotMatch(schemaSource, /socio:\s*\[\]/);
});

test('auth module composition does not wire customer or socio profile repositories', () => {
  const authIndexSource = fs.readFileSync(path.join(repoRoot, 'src/modules/auth/index.js'), 'utf8');
  const authRepositorySource = fs.readFileSync(
    path.join(repoRoot, 'src/modules/auth/infrastructure/repositories.js'),
    'utf8',
  );

  assert.doesNotMatch(authIndexSource, /customerProfileRepository|associateProfileRepository/);
  assert.doesNotMatch(authRepositorySource, /const customerProfileRepository|const associateProfileRepository/);
  assert.doesNotMatch(authRepositorySource, /Customer\.create|Associate\.create/);
  assert.doesNotMatch(authRepositorySource, /syncPrimaryKeySequenceWithCustomerProfiles/);
  assert.doesNotMatch(authRepositorySource, /FROM "Customers"/);
});

test('support payoff smoke exercises payoff flows as an administrative actor', () => {
  const source = supportScript('scripts/payoffSmokeTest.js');
  const userSeedBlock = /User\.bulkCreate\(\[([\s\S]*?)\]\);/.exec(source)?.[1] || '';

  assert.match(source, /require\(['"]module-alias\/register['"]\)/);
  assert.doesNotMatch(userSeedBlock, /role:\s*['"]customer['"]/);
  assert.doesNotMatch(userSeedBlock, /role:\s*['"]socio['"]/);
  assert.doesNotMatch(source, /buildToken\(\{\s*id:\s*\d+,\s*role:\s*['"]customer['"]/);
  assert.doesNotMatch(source, /buildToken\(\{\s*id:\s*\d+,\s*role:\s*['"]socio['"]/);
  assert.match(source, /SAFE_PAYOFF_SMOKE_ENVIRONMENTS/);
  assert.match(source, /assertSafePayoffSmokeEnvironment\(\);/);
  assert.match(source, /require\.main === module/);
});

test('associate verification seed script uses current administrative contracts', () => {
  const source = supportScript('scripts/seedAssociatePortalData.js');

  assert.match(source, /require\(['"]module-alias\/register['"]\)/);
  assert.match(source, /\/api\/associates\/\$\{associate\.id\}\/financial-details/);
  assert.doesNotMatch(source, /\/api\/associates\/\$\{associate\.id\}\/portal/);
  assert.doesNotMatch(source, /createRegisterUser|customerProfileRepository|associateProfileRepository/);
  assert.match(source, /rateSource:\s*['"]policy['"]/);
  assert.match(source, /lateFeeSource:\s*['"]policy['"]/);
  assert.doesNotMatch(source, /interestRate:\s*12/);
  assert.doesNotMatch(source, /lateFeeMode:\s*['"]NONE['"]/);
});

test('destructive support scripts require explicit operator confirmation', () => {
  const clearRateSource = supportScript('scripts/clear-rate.js');
  const repairScheduleSource = supportScript('scripts/repairCapitalPaymentSchedules.js');
  const loanProductMigrationSource = supportScript('src/scripts/migrateLoansToProducts.js');
  const resetLocalDbSource = supportScript('scripts/resetLocalDb.js');
  const resetQaCredentialsSource = supportScript('scripts/resetQaCredentials.js');
  const resetProductionQaDatasetSource = supportScript('scripts/resetProductionQaDataset.js');

  assert.match(clearRateSource, /require\(['"]dotenv['"]\)\.config\(\{ quiet: true \}\)/);
  assert.match(clearRateSource, /CLEAR_AUTH_RATE_LIMIT_CONFIRM/);
  assert.match(clearRateSource, /CLEAR_AUTH_RATE_LIMIT/);
  assert.match(clearRateSource, /assertConfirmed\(\);/);
  assert.match(clearRateSource, /DELETE FROM rate_limit_entries/);
  assert.match(clearRateSource, /require\.main === module/);

  assert.match(repairScheduleSource, /require\(['"]dotenv['"]\)\.config\(\{ quiet: true \}\)/);
  assert.match(repairScheduleSource, /REPAIR_CAPITAL_PAYMENT_SCHEDULES_CONFIRM/);
  assert.match(repairScheduleSource, /REPAIR_CAPITAL_PAYMENT_SCHEDULES/);
  assert.match(repairScheduleSource, /assertApplyConfirmed\(\{ apply \}\);/);
  assert.match(repairScheduleSource, /--apply/);
  assert.match(repairScheduleSource, /parsePositiveInteger/);
  assert.match(repairScheduleSource, /require\.main === module/);
  assert.doesNotMatch(repairScheduleSource, /const shouldApply = args\.has/);

  assert.match(loanProductMigrationSource, /require\(['"]module-alias\/register['"]\)/);
  assert.match(loanProductMigrationSource, /require\(['"]dotenv['"]\)\.config\(\{ quiet: true \}\)/);
  assert.match(loanProductMigrationSource, /MIGRATE_LOANS_TO_PRODUCTS_CONFIRM/);
  assert.match(loanProductMigrationSource, /MIGRATE_LOANS_TO_PRODUCTS/);
  assert.match(loanProductMigrationSource, /assertConfirmed\(\);/);
  assert.match(loanProductMigrationSource, /require\.main === module/);

  assert.match(resetLocalDbSource, /RESET_LOCAL_DB_ALLOW_NONLOCAL/);
  assert.match(resetLocalDbSource, /RESET_LOCAL_DB_CONFIRM/);
  assert.match(resetLocalDbSource, /assertLocalDatabaseTarget\(\);/);
  assert.match(resetLocalDbSource, /require\.main === module/);

  assert.match(resetQaCredentialsSource, /RESET_QA_CREDENTIALS_CONFIRM/);
  assert.match(resetQaCredentialsSource, /require\.main === module/);
  assert.match(resetProductionQaDatasetSource, /RESET_PRODUCTION_QA_DATASET_CONFIRM/);
  assert.match(resetProductionQaDatasetSource, /require\.main === module/);
});

test('permission catalog descriptions are Spanish operator-facing text', () => {
  const englishPermissionVerbs = /\b(View|Create|Update|Delete|Approve|Reject|Record|Reverse|Export|Generate|Grant|Assign|Revoke|Deactivate)\b/i;

  for (const permission of permissionsCatalog) {
    assert.equal(typeof permission.description, 'string', `${permission.name} is missing a description.`);
    assert.notEqual(permission.description.trim(), '', `${permission.name} has an empty description.`);
    assert.equal(
      englishPermissionVerbs.test(permission.description),
      false,
      `${permission.name} has an English-facing description: ${permission.description}`,
    );
  }
});
