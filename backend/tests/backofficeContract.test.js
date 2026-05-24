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
