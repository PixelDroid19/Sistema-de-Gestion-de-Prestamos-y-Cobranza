import { describe, expect, it } from 'vitest';
import { readdir, readFile } from 'fs/promises';
import { join, extname, relative } from 'path';

const FRONTEND_COMPONENTS = join(import.meta.dirname, '..');

const ALLOWLIST_PATH_PREFIXES = [
  'shared/tables/',
  'shared/__tests__/',
  '__tests__/',
  'reports/__tests__/',
];

const ALLOWLIST_FILES = new Set([
  'shared/TableShell.tsx',
  'shared/Surfaces.tsx',
]);

const BANNED_PATTERNS = [
  { pattern: /<table[\s>/]/, name: '<table>' },
  { pattern: /credit-installment-calendar-table/, name: 'credit-installment-calendar-table' },
  { pattern: /tableVariant\s*=\s*['"]embedded['"]/, name: 'embedded tableVariant' },
  {
    pattern: /tableVariant=["']operational["']|tableVariant=\{\s*["']operational["']\s*\}/,
    name: 'redundant operational tableVariant',
  },
  {
    pattern: /reports\.payouts\.pagination\.(previous|next)/,
    name: 'legacy report pagination footer keys',
  },
  {
    pattern: /from\s+['"][^'"]*\/OperationalTable['"]|from\s+['"][^'"]*shared\/tables['"][^;]*\bOperationalTable\b/,
    name: 'OperationalTable import',
  },
  {
    pattern: /from\s+['"][^'"]*\/FinancialScheduleTable['"]|from\s+['"][^'"]*shared\/tables['"][^;]*\bFinancialScheduleTable\b/,
    name: 'FinancialScheduleTable import',
  },
  { pattern: /<OperationalTable\b/, name: '<OperationalTable>' },
  { pattern: /<FinancialScheduleTable\b/, name: '<FinancialScheduleTable>' },
  { pattern: /\bresolveUseTableShell\b/, name: 'resolveUseTableShell (internal)' },
  { pattern: /\btoggleActionMenu\b/, name: 'legacy fixed action menu (use RowActionsWithOverflow)' },
  {
    pattern: /<MoreVertical\b|MoreVertical\s+size=/,
    name: 'MoreVertical row menu (use RowActionsWithOverflow)',
  },
];

const TABLE_ENTRY_IMPORT =
  /\b(AppTable|ReportDataTableSection)\b/;

async function* getComponentFiles(dir: string): AsyncGenerator<string> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      yield* getComponentFiles(fullPath);
      continue;
    }

    if (!['.tsx', '.ts'].includes(extname(entry.name))) continue;

    const relativePath = relative(FRONTEND_COMPONENTS, fullPath).replace(/\\/g, '/');
    if (ALLOWLIST_FILES.has(relativePath)) continue;
    if (ALLOWLIST_PATH_PREFIXES.some((prefix) => relativePath.startsWith(prefix))) continue;

    yield relativePath;
  }
}

describe('Table markup contract', () => {
  it('screens must use AppTable and avoid raw table markup', async () => {
    const violations: string[] = [];

    for await (const file of getComponentFiles(FRONTEND_COMPONENTS)) {
      const content = await readFile(join(FRONTEND_COMPONENTS, file), 'utf-8');
      const lines = content.split('\n');

      if (/<thead[\s>/]/.test(content) && !TABLE_ENTRY_IMPORT.test(content)) {
        violations.push(`${file} (missing AppTable or ReportDataTableSection import)`);
      }

      for (const { pattern, name } of BANNED_PATTERNS) {
        lines.forEach((line, index) => {
          if (pattern.test(line)) {
            violations.push(`${file}:${index + 1} (${name})`);
          }
        });
      }
    }

    expect(
      violations,
      violations.length > 0
        ? `Use AppTable from shared/tables:\n${violations.join('\n')}`
        : undefined,
    ).toHaveLength(0);
  });
});
