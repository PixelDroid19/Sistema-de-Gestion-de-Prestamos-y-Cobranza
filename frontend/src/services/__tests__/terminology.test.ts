import { getTermAliases, tTerm } from '../../i18n/terminology';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('terminology canonical dictionary', () => {
  it('returns canonical terms by default', () => {
    expect(tTerm('sidebar.customers.directory')).toBe('Lista de clientes');
    expect(tTerm('credits.module.title')).toBe('Operación de créditos');
  });

  it('keeps customer fallback labels free of internal identifiers', () => {
    expect(tTerm('credits.label.customerFallback', { id: 44 })).toBe('Cliente');
  });

  it('uses a neutral missing-value mark instead of the technical N/A abbreviation', () => {
    expect(tTerm('common.notAvailable')).toBe('—');
  });

  it('keeps report export validation messages free of internal id terminology', () => {
    const messages = [
      tTerm('reports.export.invalidCustomer'),
      tTerm('reports.export.invalidLoan'),
    ];

    expect(messages.join(' ')).not.toMatch(/\bID\b/i);
    expect(tTerm('reports.export.invalidCustomer')).toBe('Selecciona un cliente válido.');
    expect(tTerm('reports.export.invalidLoan')).toBe('Selecciona un crédito válido.');
  });

  it('does not expose English loan-id errors from report services', () => {
    const source = readFileSync(join(process.cwd(), 'src/services/reportService.ts'), 'utf8');

    expect(source).not.toContain('Loan ID is required');
  });

  it('does not expose outdated aliases', () => {
    expect(getTermAliases('sidebar.customers.directory')).toEqual([]);
    expect(getTermAliases('sidebar.dashboard')).toEqual([]);
  });
});
