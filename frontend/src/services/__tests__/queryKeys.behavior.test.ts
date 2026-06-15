import { describe, expect, it } from 'vitest';
import { queryKeys } from '../queryKeys';

describe('queryKeys customers', () => {
  it('keeps customer list keys under the customers root for partial invalidation', () => {
    expect(queryKeys.customers.list({ status: 'active' })).toEqual([
      'customers',
      'list',
      { status: 'active' },
    ]);
  });

  it('keeps customer documents keys under the customers root for partial invalidation', () => {
    expect(queryKeys.customers.documents(7)).toEqual(['customers', 'documents', 7]);
  });

  it('scopes a customer loans key to the byCustomer root', () => {
    expect(queryKeys.loans.byCustomer(5, { pageSize: 200 })).toEqual([
      'loans.byCustomer',
      5,
      { pageSize: 200 },
    ]);
  });
});

describe('queryKeys audit', () => {
  it('preserves the audit logs key shape with filters', () => {
    expect(queryKeys.audit.logs({ module: 'credit', page: 2 })).toEqual([
      'audit.logs',
      { module: 'credit', page: 2 },
    ]);
  });

  it('defaults audit logs filters to an empty object', () => {
    expect(queryKeys.audit.logs()).toEqual(['audit.logs', {}]);
  });

  it('preserves the audit stats key shape', () => {
    expect(queryKeys.audit.stats('2026-01-01', '2026-06-30')).toEqual([
      'audit.stats',
      '2026-01-01',
      '2026-06-30',
    ]);
  });
});

describe('queryKeys permissions', () => {
  it('keeps per-user permission keys under the userRoot prefix for partial invalidation', () => {
    expect(queryKeys.permissions.user(42)).toEqual(['permissions.user', 42]);
    expect(queryKeys.permissions.userRoot).toEqual(['permissions.user']);
    expect(queryKeys.permissions.user(42).slice(0, 1)).toEqual([...queryKeys.permissions.userRoot]);
  });

  it('exposes stable roots for list, byModule and myPermissions', () => {
    expect(queryKeys.permissions.list).toEqual(['permissions.list']);
    expect(queryKeys.permissions.byModule('CREDITS')).toEqual(['permissions.byModule', 'CREDITS']);
    expect(queryKeys.permissions.myPermissions).toEqual(['permissions.myPermissions']);
    expect(queryKeys.permissions.myPermissionsSummary).toEqual(['permissions.myPermissionsSummary']);
  });
});
