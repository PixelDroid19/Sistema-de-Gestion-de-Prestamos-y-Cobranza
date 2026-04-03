import { getTermAliases, tTerm } from '../../i18n/terminology';

describe('terminology canonical dictionary', () => {
  it('returns canonical terms by default', () => {
    expect(tTerm('sidebar.customers.directory')).toBe('Lista de clientes');
    expect(tTerm('credits.module.title')).toBe('Operación de créditos');
  });

  it('returns legacy aliases when requested', () => {
    expect(tTerm('sidebar.customers.directory', { legacy: true })).toBe('Directorio');
    expect(tTerm('credits.module.title', { legacy: true })).toBe('Gestión de Créditos');
  });

  it('returns an empty alias list for keys without aliases', () => {
    expect(getTermAliases('sidebar.dashboard')).toEqual([]);
  });
});
