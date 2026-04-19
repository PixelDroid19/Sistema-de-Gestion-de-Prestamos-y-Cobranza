#!/usr/bin/env node
/**
 * Migration script: converts relative require() paths to @/ alias imports.
 *
 * Rules:
 * - Files in src/: relative requires that resolve to other files in src/ → @/...
 * - Files in tests/: requires that go through ../src/ → @/...
 * - Same-directory requires (./) are kept as-is.
 * - Only converts parent-traversal requires (../).
 * - Dry-run mode: node scripts/migrateToAlias.js --dry-run
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const TESTS = path.join(ROOT, 'tests');

const dryRun = process.argv.includes('--dry-run');

function getAllJsFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...getAllJsFiles(full));
    } else if (entry.name.endsWith('.js')) {
      results.push(full);
    }
  }
  return results;
}

/**
 * Given a file and a relative require path, resolve to absolute,
 * then check if it falls inside src/. If so, return the @/ form.
 */
function convertRequire(filePath, relPath) {
  // Skip same-dir requires
  if (relPath.startsWith('./')) return null;
  // Only handle parent traversals
  if (!relPath.startsWith('../')) return null;

  const fileDir = path.dirname(filePath);
  const resolved = path.resolve(fileDir, relPath);

  // Check if the resolved path is inside src/
  const relToSrc = path.relative(SRC, resolved);
  if (relToSrc.startsWith('..') || path.isAbsolute(relToSrc)) {
    return null; // not inside src/
  }

  return '@/' + relToSrc.replace(/\\/g, '/');
}

const REQUIRE_RE = /require\(\s*['"]([^'"]+)['"]\s*\)/g;

let totalFiles = 0;
let totalChanges = 0;

function processFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  let changed = false;
  const newContent = content.replace(REQUIRE_RE, (match, reqPath) => {
    const alias = convertRequire(filePath, reqPath);
    if (alias) {
      changed = true;
      totalChanges++;
      // Preserve original quote style
      const quote = match.includes("'") ? "'" : '"';
      return `require(${quote}${alias}${quote})`;
    }
    return match;
  });

  if (changed) {
    totalFiles++;
    const rel = path.relative(ROOT, filePath);
    if (dryRun) {
      console.log(`[DRY RUN] Would update: ${rel}`);
    } else {
      fs.writeFileSync(filePath, newContent, 'utf8');
      console.log(`Updated: ${rel}`);
    }
  }
}

// Process all files in src/ and tests/
const allFiles = [...getAllJsFiles(SRC), ...getAllJsFiles(TESTS)];
for (const f of allFiles) {
  processFile(f);
}

console.log(`\n${dryRun ? '[DRY RUN] ' : ''}Done: ${totalChanges} requires in ${totalFiles} files.`);
