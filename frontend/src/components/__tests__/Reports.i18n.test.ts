import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const readSource = (relativePath: string) => readFileSync(new URL(relativePath, import.meta.url), 'utf8');

describe('Reports i18n contracts', () => {
  it('keeps visible report range separators in dictionaries', () => {
    const reportsSource = readSource('../Reports.tsx');
    const payoutsSource = readSource('../reports/PayoutsTab.tsx');

    expect(payoutsSource).not.toContain('>a</span>');
    expect(reportsSource).not.toContain('Excel (xlsx)');
    expect(reportsSource).not.toContain('>PDF</option>');
  });
});
