import { describe, expect, it } from 'vitest';
import { assert, Equals } from 'tsafe';

import { PostgresTable } from '../../src/types';
import { Query } from '../../src/query';
import DB from './test-db';

it('PostgresTable optional null types in post', () => {
  type TestTable = PostgresTable<
    { id: number; col1: string; col2: string | null },
    'col1'
  >;

  assert<
    Equals<
      TestTable['post'],
      {
        id: number;
        col1?: string;
        col2?: string | null;
      }
    >
  >();
});

it('immutability', () => {
  const query = new Query<DB, 'test_table'>({ tableName: 'test_table' });
  // calling a method returns a new immutable instance
  expect(query).not.toBe(query.single());
  expect(query).not.toBe(query.eq('col1', 'val'));
  // calling a method returns a different object
  expect(query).not.toEqual(query.single().toObject());
  expect(query).not.toEqual(query.eq('col1', 'val').toObject());
});

describe('columns', () => {
  const query = new Query<DB, 'test_table'>({ tableName: 'test_table' });

  it('simple', () => {
    expect(query.toString()).toBe('');
    expect(query.columns(['id', 'col1']).toObject().columns).toEqual([
      'id',
      'col1',
    ]);
    expect(query.columns(['id']).toObject().columns).toEqual(['id']);
    expect(query.columns(['id', 'col1']).toString({ encoded: false })).toBe(
      'columns=id,col1',
    );
    expect(query.columns(['id']).toString({ encoded: false })).toBe(
      'columns=id',
    );
  });

  it('ignore on embedded', () => {
    const q2 = new Query<DB, 'test_table2'>({ tableName: 'test_table2' });
    expect(
      query
        .columns(['id', 'col1'])
        // q2.columns(...) is ignored
        .select(q2.select('*').columns(['id', 'table1_id']))
        .toString({ encoded: false }),
    ).toBe('select=test_table2(*)&columns=id,col1');
  });
});

describe('onConflict', () => {
  const query = new Query<DB, 'test_table'>({ tableName: 'test_table' });

  it('header', () => {
    const q = query.onConflict('ignore-duplicates');
    const { resolution, onConflict } = q.toObject();
    expect(resolution).toBe('ignore-duplicates');
    expect(onConflict).toBeUndefined();
  });

  it('on_conflict query param', () => {
    const q = query.onConflict('merge-duplicates', 'id');
    const { resolution, onConflict } = q.toObject();
    expect(resolution).toBe('merge-duplicates');
    expect(onConflict).toBe('id');
    expect(q.toString({ encoded: false })).toBe('on_conflict=id');
  });
});
