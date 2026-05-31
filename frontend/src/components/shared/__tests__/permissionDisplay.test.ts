import { beforeEach, describe, expect, it } from 'vitest';
import { getPermissionDisplayName, getPermissionModuleLabel } from '../permissionDisplay';

const t = (key: string) => ({
  'settings.employees.modal.permissions.actions.manage': 'Gestionar',
  'settings.employees.modal.permissions.actions.view': 'Consultar',
}[key] || key);

const tEn = (key: string) => ({
  'settings.employees.modal.permissions.actions.manage': 'Manage',
  'settings.employees.modal.permissions.actions.view': 'View',
}[key] || key);

describe('permission display helpers', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('renders known permission modules with operational labels', () => {
    expect(getPermissionModuleLabel('credits')).toBe('Créditos');
    expect(getPermissionDisplayName({
      permission: 'READ_CREDITS',
      module: 'credits',
    }, t)).toBe('Consultar créditos');
  });

  it('does not expose unknown permission modules directly', () => {
    expect(getPermissionModuleLabel('risk_engine')).toBe('Módulo no clasificado');
    expect(getPermissionDisplayName({
      permission: 'MANAGE_RISK_ENGINE',
      module: 'risk_engine',
    }, t)).toBe('Gestionar módulo no clasificado');
  });

  it('resolves module labels from the active locale', () => {
    window.localStorage.setItem('app.locale', 'en');

    expect(getPermissionModuleLabel('credits')).toBe('Loans');
    expect(getPermissionDisplayName({
      permission: 'READ_CREDITS',
      module: 'credits',
    }, tEn)).toBe('View loans');
    expect(getPermissionModuleLabel('risk_engine')).toBe('Unclassified module');
  });
});
