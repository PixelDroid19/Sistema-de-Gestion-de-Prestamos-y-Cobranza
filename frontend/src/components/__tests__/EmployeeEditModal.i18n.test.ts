import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const readSource = (relativePath: string) => readFileSync(new URL(relativePath, import.meta.url), 'utf8');

describe('EmployeeEditModal i18n contracts', () => {
  it('keeps permissions summary aria text in dictionaries', () => {
    const source = readSource('../EmployeeEditModal.tsx');

    expect(source).not.toContain('aria-label="Resumen"');
  });
});
