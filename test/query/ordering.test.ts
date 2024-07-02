import { describe, expect, it } from 'vitest';

import { Query } from '../../src/query';
import DB from './test-db';

describe('order', () => {
  const query = new Query<DB, 'test_table'>({ tableName: 'test_table' });

  it('simple', () => {
    expect(query.order([{ column: 'id' }]).toString({ encoded: false })).toBe(
      'order=id',
    );
  });

  it('direction', () => {
    expect(
      query
        .order([{ column: 'id', order: 'desc' }])
        .toString({ encoded: false }),
    ).toBe('order=id.desc');
    expect(
      query
        .order([{ column: 'id', order: 'asc' }])
        .toString({ encoded: false }),
    ).toBe('order=id.asc');
  });

  it('nullsfirst and nullslast', () => {
    expect(
      query
        .order([{ column: 'col1', nulls: 'first' }])
        .toString({ encoded: false }),
    ).toBe('order=col1.nullsfirst');
    expect(
      query
        .order([{ column: 'col1', nulls: 'last' }])
        .toString({ encoded: false }),
    ).toBe('order=col1.nullslast');
  });

  it('multiple fields with nulls', () => {
    expect(
      query
        .order([
          { column: 'id', order: 'desc' },
          { column: 'col1', order: 'desc', nulls: 'first' },
        ])
        .toString({ encoded: false }),
    ).toBe('order=id.desc,col1.desc.nullsfirst');
  });

  it('non-commutative order - [a,b] != [b,a]', () => {
    expect(
      query
        .order([{ column: 'id' }, { column: 'col1' }])
        .toString({ encoded: false }),
    ).toBe('order=id,col1');
    expect(
      query
        .order([{ column: 'col1' }, { column: 'id' }])
        .toString({ encoded: false }),
    ).toBe('order=col1,id');
  });
});
