import { describe, expect, it } from 'vitest';

import { Query } from '../../src/query';
import DB from './test-db';

describe('count', () => {
  const query = new Query<DB, 'test_table'>({ tableName: 'test_table' });

  it('limit', () => {
    expect(query.limit(10).toString({ encoded: false })).toBe('limit=10');
  });

  it('offset', () => {
    expect(query.offset(10).toString({ encoded: false })).toBe('offset=10');
  });

  it('limit and offset', () => {
    expect(query.offset(10).limit(10).toString({ encoded: false })).toBe(
      'limit=10&offset=10',
    );
  });

  it('page', () => {
    expect(query.page(1).toString({ encoded: false })).toBe(
      'limit=10&offset=10',
    );
    expect(query.page(1, 10).toString({ encoded: false })).toBe(
      'limit=10&offset=10',
    );
    expect(query.page(1, 20).toString({ encoded: false })).toBe(
      'limit=20&offset=20',
    );
    expect(query.page(2).toString({ encoded: false })).toBe(
      query.offset(20).limit(10).toString({ encoded: false }),
    );
    expect(query.page(0, 20).toString({ encoded: false })).toBe(
      query.offset(0).limit(20).toString({ encoded: false }),
    );
    expect(query.page(2, 20).toString({ encoded: false })).toBe(
      query.offset(40).limit(20).toString({ encoded: false }),
    );
  });
});
