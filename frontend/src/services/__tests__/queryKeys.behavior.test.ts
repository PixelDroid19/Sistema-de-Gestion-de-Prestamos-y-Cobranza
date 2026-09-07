import { describe, expect, it } from 'vitest';
import { queryKeys } from '../queryKeys';
import { QueryClient } from '@tanstack/react-query';

describe('report cache invalidation', () => {
  it('invalidates cached financial reports after an operating expense changes', async () => {
    const client = new QueryClient();
    const reports = [
      queryKeys.reports.monthlyCashFlow(2026),
      queryKeys.reports.monthlyCashFlow(2026, { fromDate: '2026-09-07', toDate: '2026-09-07' }),
      queryKeys.reports.dashboard,
      queryKeys.reports.payouts({}, 1, 20),
    ];
    try {
      for (const key of reports) client.setQueryData(key, { total: 50000 });
      client.setQueryData(queryKeys.customers.list(), []);
      await client.invalidateQueries({ queryKey: queryKeys.reports.all });
      for (const key of reports) expect(client.getQueryState(key)?.isInvalidated).toBe(true);
      expect(client.getQueryState(queryKeys.customers.list())?.isInvalidated).toBe(false);
    } finally {
      client.clear();
    }
  });
});

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
