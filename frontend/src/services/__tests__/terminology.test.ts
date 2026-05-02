import { getTermAliases, tTerm } from '../../i18n/terminology';

describe('terminology canonical dictionary', () => {
  it('returns canonical terms by default', () => {
    expect(tTerm('sidebar.customers.directory')).toBe('Lista de clientes');
    expect(tTerm('credits.module.title')).toBe('Operación de créditos');
  });

  it('does not expose outdated aliases', () => {
    expect(getTermAliases('sidebar.customers.directory')).toEqual([]);
    expect(getTermAliases('sidebar.dashboard')).toEqual([]);
  });
});
