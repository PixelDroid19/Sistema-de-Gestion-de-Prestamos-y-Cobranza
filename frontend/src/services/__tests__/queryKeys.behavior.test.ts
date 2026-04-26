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
});
