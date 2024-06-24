import { describe, expect, it } from 'vitest';
import { Equals, assert } from 'tsafe';

import { GetQueryToResponse } from '../../../src/types';
import { Query } from '../../../src/query';
import DB from '../test-db';

describe('vertical filtering', () => {
  const query = new Query<DB, 'test_table'>({ tableName: 'test_table' });

  it('simple string', () => {
    // @ts-expect-error invalid select
    query.select('invalid');

    expect(query.toObject().select).toEqual([]);
    type Query = GetQueryToResponse<typeof query>;
    assert<Equals<Query, { rows: { id: number; col1: string }[] }>>();
    expect(query.toString({ encoded: false })).toBe('');

    const qIdOnly = query.select('id');
    type IdOnlyQuery = GetQueryToResponse<typeof qIdOnly>;
    expect(qIdOnly.toObject().select).toEqual(['id']);
    assert<Equals<IdOnlyQuery, { rows: { id: number }[] }>>();
    expect(qIdOnly.toString({ encoded: false })).toBe('select=id');

    const starOnly = query.select('*');
    type StarOnlyQuery = GetQueryToResponse<typeof starOnly>;
    expect(starOnly.toObject().select).toEqual(['*']);
    assert<Equals<StarOnlyQuery, { rows: { id: number; col1: string }[] }>>();
    expect(starOnly.toString({ encoded: false })).toBe('select=*');

    // NOTE: PostgREST is ignoring column selectors when "*" is included.
    const starAndColumn = query.select('*').select('id');
    type StarAndColumnQuery = GetQueryToResponse<typeof starAndColumn>;
    expect(starAndColumn.toObject().select).toEqual(['*', 'id']);
    assert<
      Equals<StarAndColumnQuery, { rows: { id: number; col1: string }[] }>
    >();
    expect(starAndColumn.toString({ encoded: false })).toBe('select=*,id');
  });

  it('simple array', () => {
    const qIdOnly = query.select(['id']);
    type IdOnlyQuery = GetQueryToResponse<typeof qIdOnly>;
    expect(qIdOnly.toObject().select).toEqual(['id']);
    assert<Equals<IdOnlyQuery, { rows: { id: number }[] }>>();
    expect(qIdOnly.toString({ encoded: false })).toBe('select=id');

    const starOnly = query.select(['*']);
    type StarOnlyQuery = GetQueryToResponse<typeof starOnly>;
    expect(starOnly.toObject().select).toEqual(['*']);
    assert<Equals<StarOnlyQuery, { rows: { id: number; col1: string }[] }>>();
    expect(starOnly.toString({ encoded: false })).toBe('select=*');

    // NOTE: PostgREST is ignoring column selectors when "*" is included.
    const starAndColumn = query.select(['*']).select(['id']);
    type StarAndColumnQuery = GetQueryToResponse<typeof starAndColumn>;
    expect(starAndColumn.toObject().select).toEqual(['*', 'id']);
    assert<
      Equals<StarAndColumnQuery, { rows: { id: number; col1: string }[] }>
    >();
    expect(starAndColumn.toString({ encoded: false })).toBe('select=*,id');

    // NOTE: PostgREST is ignoring column selectors when "*" is included.
    const starAndColumn2 = query.select(['id']).select(['*']);
    type StarAndColumn2Query = GetQueryToResponse<typeof starAndColumn2>;
    expect(starAndColumn2.toObject().select).toEqual(['id', '*']);
    assert<
      Equals<StarAndColumn2Query, { rows: { id: number; col1: string }[] }>
    >();
    expect(starAndColumn2.toString({ encoded: false })).toBe('select=id,*');

    // NOTE: PostgREST is ignoring column selectors when "*" is included.
    const starAndColumnArray = query.select(['*', 'id']);
    type StarAndColumnArrayQuery = GetQueryToResponse<
      typeof starAndColumnArray
    >;
    expect(starAndColumnArray.toObject().select).toEqual(['*', 'id']);
    assert<
      Equals<StarAndColumnArrayQuery, { rows: { id: number; col1: string }[] }>
    >();
    expect(starAndColumn.toString({ encoded: false })).toBe('select=*,id');
  });

  it('string with modifier', () => {
    // @ts-expect-error invalid select
    query.select(['*', { name: 'invalid' }]);

    const singleRenamed = query.select(['col1', { name: 'renamed' }]);
    type SingleRenamedQuery = GetQueryToResponse<typeof singleRenamed>;
    expect(singleRenamed.toObject().select).toEqual([
      { column: 'col1', modifier: { name: 'renamed' } },
    ]);
    assert<Equals<SingleRenamedQuery, { rows: { renamed: string }[] }>>();
    expect(singleRenamed.toString({ encoded: false })).toBe(
      'select=renamed:col1',
    );

    const castAndRename = query
      .select(['id', { cast: 'text' }])
      .select(['col1', { name: 'renamed' }]);
    type CastAndRenameQuery = GetQueryToResponse<typeof castAndRename>;
    expect(castAndRename.toObject().select).toEqual([
      { column: 'id', modifier: { cast: 'text' } },
      { column: 'col1', modifier: { name: 'renamed' } },
    ]);
    assert<
      Equals<CastAndRenameQuery, { rows: { id: string; renamed: string }[] }>
    >();
    expect(castAndRename.toString({ encoded: false })).toBe(
      'select=id::text,renamed:col1',
    );

    const starAndRenamedColumn = query
      .select('*')
      .select(['col1', { name: 'renamed' }]);
    type StarAndRenamedColumnQuery = GetQueryToResponse<
      typeof starAndRenamedColumn
    >;
    expect(starAndRenamedColumn.toObject().select).toEqual([
      '*',
      { column: 'col1', modifier: { name: 'renamed' } },
    ]);
    assert<
      Equals<
        StarAndRenamedColumnQuery,
        { rows: { id: number; col1: string; renamed: string }[] }
      >
    >();
    expect(starAndRenamedColumn.toString({ encoded: false })).toBe(
      'select=*,renamed:col1',
    );
  });

  it('simple single embedded filter', () => {
    const q1 = new Query<DB, 'test_table2'>({ tableName: 'test_table2' });
    const q2 = query.single();

    const qBothEmptyFromEmbedded = q1.select(q2);
    type BothEmptyFromEmbeddedQuery = GetQueryToResponse<
      typeof qBothEmptyFromEmbedded
    >;
    expect(qBothEmptyFromEmbedded.toObject().select).toMatchObject([
      { tableName: 'test_table', select: [] },
    ]);
    assert<Equals<BothEmptyFromEmbeddedQuery, { rows: object[] }>>();
    expect(qBothEmptyFromEmbedded.toString({ encoded: false })).toBe(
      'select=test_table()',
    );

    const qAllFromEmbedded = q1.select(q2.select('*'));
    type AllFromEmbeddedQuery = GetQueryToResponse<typeof qAllFromEmbedded>;
    expect(qAllFromEmbedded.toObject().select).toMatchObject([
      { tableName: 'test_table', select: ['*'] },
    ]);
    assert<
      Equals<
        AllFromEmbeddedQuery,
        { rows: { test_table: { id: number; col1: string } }[] }
      >
    >();
    expect(qAllFromEmbedded.toString({ encoded: false })).toBe(
      'select=test_table(*)',
    );

    const qAllFromEmbedded2 = q1.select(q2.select(['*']));
    type AllFromEmbedded2Query = GetQueryToResponse<typeof qAllFromEmbedded2>;
    expect(qAllFromEmbedded2.toObject().select).toMatchObject([
      { tableName: 'test_table', select: ['*'] },
    ]);
    assert<
      Equals<
        AllFromEmbedded2Query,
        { rows: { test_table: { id: number; col1: string } }[] }
      >
    >();
    expect(qAllFromEmbedded2.toString({ encoded: false })).toBe(
      'select=test_table(*)',
    );

    const qAllFromMainEmptyEmbedded = q1.select('*').select(q2);
    type AllFromMainEmptyEmbeddedQuery = GetQueryToResponse<
      typeof qAllFromMainEmptyEmbedded
    >;
    expect(qAllFromMainEmptyEmbedded.toObject().select).toMatchObject([
      '*',
      { tableName: 'test_table', select: [] },
    ]);
    assert<
      Equals<
        AllFromMainEmptyEmbeddedQuery,
        {
          rows: {
            id: number;
            table1_id: number;
          }[];
        }
      >
    >();
    expect(qAllFromMainEmptyEmbedded.toString({ encoded: false })).toBe(
      'select=*,test_table()',
    );

    const qAllFromBoth = q1.select('*').select(q2.select('*'));
    type AllFromBothQuery = GetQueryToResponse<typeof qAllFromBoth>;
    expect(qAllFromBoth.toObject().select).toMatchObject([
      '*',
      { tableName: 'test_table', select: ['*'] },
    ]);
    assert<
      Equals<
        AllFromBothQuery,
        {
          rows: {
            id: number;
            table1_id: number;
            test_table: { id: number; col1: string };
          }[];
        }
      >
    >();
    expect(qAllFromBoth.toString({ encoded: false })).toBe(
      'select=*,test_table(*)',
    );

    const qAllFromBoth2 = q1.select('*').select(q2.select(['*']));
    type AllFromBoth2Query = GetQueryToResponse<typeof qAllFromBoth2>;
    expect(qAllFromBoth2.toObject().select).toMatchObject([
      '*',
      { tableName: 'test_table', select: ['*'] },
    ]);
    assert<
      Equals<
        AllFromBoth2Query,
        {
          rows: {
            id: number;
            table1_id: number;
            test_table: { id: number; col1: string };
          }[];
        }
      >
    >();
    expect(qAllFromBoth2.toString({ encoded: false })).toBe(
      'select=*,test_table(*)',
    );

    const qAllFromBoth3 = q1.select(['*']).select(q2.select(['*']));
    type AllFromBoth3Query = GetQueryToResponse<typeof qAllFromBoth3>;
    expect(qAllFromBoth3.toObject().select).toMatchObject([
      '*',
      { tableName: 'test_table', select: ['*'] },
    ]);
    assert<
      Equals<
        AllFromBoth3Query,
        {
          rows: {
            id: number;
            table1_id: number;
            test_table: { id: number; col1: string };
          }[];
        }
      >
    >();
    expect(qAllFromBoth3.toString({ encoded: false })).toBe(
      'select=*,test_table(*)',
    );

    const qColumnsOnly = q1.select('id').select(q2.select('col1'));
    type ColumnsOnlyQuery = GetQueryToResponse<typeof qColumnsOnly>;
    expect(qColumnsOnly.toObject().select).toMatchObject([
      'id',
      { tableName: 'test_table', select: ['col1'] },
    ]);
    assert<
      Equals<
        ColumnsOnlyQuery,
        {
          rows: {
            id: number;
            test_table: { col1: string };
          }[];
        }
      >
    >();
    expect(qColumnsOnly.toString({ encoded: false })).toBe(
      'select=id,test_table(col1)',
    );

    // NOTE: PostgREST is ignoring column selectors when "*" is included.
    const qEmbeddedStarAndColumn = q1
      .select('id')
      .select(q2.select('*').select('col1'));
    type EmbeddedStarAndColumnQuery = GetQueryToResponse<
      typeof qEmbeddedStarAndColumn
    >;
    expect(qEmbeddedStarAndColumn.toObject().select).toMatchObject([
      'id',
      { tableName: 'test_table', select: ['*', 'col1'] },
    ]);
    assert<
      Equals<
        EmbeddedStarAndColumnQuery,
        {
          rows: {
            id: number;
            test_table: { id: number; col1: string };
          }[];
        }
      >
    >();
    expect(qEmbeddedStarAndColumn.toString({ encoded: false })).toBe(
      'select=id,test_table(*,col1)',
    );
  });

  it('simple many embedded filter', () => {
    const q1 = new Query<DB, 'test_table'>({ tableName: 'test_table' });
    const q2 = new Query<DB, 'test_table2'>({ tableName: 'test_table2' });

    const qBothEmpty = q1.select(q2);
    type IdBothEmptyQuery = GetQueryToResponse<typeof qBothEmpty>;
    expect(qBothEmpty.toObject().select).toMatchObject([
      { tableName: 'test_table2', select: [] },
    ]);
    assert<Equals<IdBothEmptyQuery, { rows: object[] }>>();
    expect(qBothEmpty.toString({ encoded: false })).toBe(
      'select=test_table2()',
    );

    const qAllFromEmbedded = q1.select(q2.select('*'));
    type IdAllFromEmbeddedQuery = GetQueryToResponse<typeof qAllFromEmbedded>;
    expect(qAllFromEmbedded.toObject().select).toMatchObject([
      { tableName: 'test_table2', select: ['*'] },
    ]);
    assert<
      Equals<
        IdAllFromEmbeddedQuery,
        { rows: { test_table2: { id: number; table1_id: number }[] }[] }
      >
    >();
    expect(qAllFromEmbedded.toString({ encoded: false })).toBe(
      'select=test_table2(*)',
    );

    const qAllFromEmbedded2 = q1.select(q2.select(['*']));
    type IdAllFromEmbedded2Query = GetQueryToResponse<typeof qAllFromEmbedded2>;
    expect(qAllFromEmbedded2.toObject().select).toMatchObject([
      { tableName: 'test_table2', select: ['*'] },
    ]);
    assert<
      Equals<
        IdAllFromEmbedded2Query,
        { rows: { test_table2: { id: number; table1_id: number }[] }[] }
      >
    >();
    expect(qAllFromEmbedded2.toString({ encoded: false })).toBe(
      'select=test_table2(*)',
    );

    const qAllFromMain = q1.select('*').select(q2);
    type AllFromMainQuery = GetQueryToResponse<typeof qAllFromMain>;
    expect(qAllFromMain.toObject().select).toMatchObject([
      '*',
      { tableName: 'test_table2', select: [] },
    ]);
    assert<
      Equals<
        AllFromMainQuery,
        {
          rows: {
            id: number;
            col1: string;
          }[];
        }
      >
    >();
    expect(qAllFromMain.toString({ encoded: false })).toBe(
      'select=*,test_table2()',
    );

    const qAllFromBoth = q1.select('*').select(q2.select('*'));
    type AllFromBothQuery = GetQueryToResponse<typeof qAllFromBoth>;
    expect(qAllFromBoth.toObject().select).toMatchObject([
      '*',
      { tableName: 'test_table2', select: ['*'] },
    ]);
    assert<
      Equals<
        AllFromBothQuery,
        {
          rows: {
            id: number;
            col1: string;
            test_table2: { id: number; table1_id: number }[];
          }[];
        }
      >
    >();
    expect(qAllFromBoth.toString({ encoded: false })).toBe(
      'select=*,test_table2(*)',
    );

    const qAllFromBoth2 = q1.select('*').select(q2.select(['*']));
    type AllFromBoth2Query = GetQueryToResponse<typeof qAllFromBoth2>;
    expect(qAllFromBoth2.toObject().select).toMatchObject([
      '*',
      { tableName: 'test_table2', select: ['*'] },
    ]);
    assert<
      Equals<
        AllFromBoth2Query,
        {
          rows: {
            id: number;
            col1: string;
            test_table2: { id: number; table1_id: number }[];
          }[];
        }
      >
    >();
    expect(qAllFromBoth2.toString({ encoded: false })).toBe(
      'select=*,test_table2(*)',
    );

    const qAllFromBoth3 = q1.select(['*']).select(q2.select(['*']));
    type AllFromBoth3Query = GetQueryToResponse<typeof qAllFromBoth3>;
    expect(qAllFromBoth3.toObject().select).toMatchObject([
      '*',
      { tableName: 'test_table2', select: ['*'] },
    ]);
    assert<
      Equals<
        AllFromBoth3Query,
        {
          rows: {
            id: number;
            col1: string;
            test_table2: { id: number; table1_id: number }[];
          }[];
        }
      >
    >();
    expect(qAllFromBoth3.toString({ encoded: false })).toBe(
      'select=*,test_table2(*)',
    );

    const qColumnsOnly = q1.select('id').select(q2.select('table1_id'));
    type ColumnsOnlyQuery = GetQueryToResponse<typeof qColumnsOnly>;
    expect(qColumnsOnly.toObject().select).toMatchObject([
      'id',
      { tableName: 'test_table2', select: ['table1_id'] },
    ]);
    assert<
      Equals<
        ColumnsOnlyQuery,
        {
          rows: {
            id: number;
            test_table2: { table1_id: number }[];
          }[];
        }
      >
    >();
    expect(qColumnsOnly.toString({ encoded: false })).toBe(
      'select=id,test_table2(table1_id)',
    );

    // NOTE: PostgREST is ignoring column selectors when "*" is included.
    const qEmbeddedStarAndColumn = q1
      .select('id')
      .select(q2.select('*').select('table1_id'));
    type EmbeddedStarAndColumnQuery = GetQueryToResponse<
      typeof qEmbeddedStarAndColumn
    >;
    expect(qEmbeddedStarAndColumn.toObject().select).toMatchObject([
      'id',
      { tableName: 'test_table2', select: ['*', 'table1_id'] },
    ]);
    assert<
      Equals<
        EmbeddedStarAndColumnQuery,
        {
          rows: {
            id: number;
            test_table2: { id: number; table1_id: number }[];
          }[];
        }
      >
    >();
    expect(qEmbeddedStarAndColumn.toString({ encoded: false })).toBe(
      'select=id,test_table2(*,table1_id)',
    );
  });

  it('embedded with rename', () => {
    const q1 = new Query<DB, 'test_table'>({ tableName: 'test_table' });
    const q2 = new Query<DB, 'test_table2'>({ tableName: 'test_table2' });

    const qBothEmpty = q1.select([q2, { name: 'table2' }]);
    type IdBothEmptyQuery = GetQueryToResponse<typeof qBothEmpty>;
    expect(qBothEmpty.toObject().select).toMatchObject([
      {
        query: { tableName: 'test_table2', select: [] },
        modifier: { name: 'table2' },
      },
    ]);
    assert<Equals<IdBothEmptyQuery, { rows: object[] }>>();
    expect(qBothEmpty.toString({ encoded: false })).toBe(
      'select=table2:test_table2()',
    );

    const qArrayIdsOnly = q1.select([
      'id',
      [q2.select('id'), { name: 'table2' }],
    ]);
    type ArrayIdsOnlyQuery = GetQueryToResponse<typeof qArrayIdsOnly>;
    expect(qArrayIdsOnly.toObject().select).toMatchObject([
      'id',
      {
        query: { tableName: 'test_table2', select: ['id'] },
        modifier: { name: 'table2' },
      },
    ]);
    assert<
      Equals<
        ArrayIdsOnlyQuery,
        { rows: { id: number; table2: { id: number }[] }[] }
      >
    >();
    expect(qArrayIdsOnly.toString({ encoded: false })).toBe(
      'select=id,table2:test_table2(id)',
    );

    // embedded is an object (it's an array above - one-to-many)
    const qSingleEmbedded = q2.select([
      'id',
      [q1.select('id').single(), { name: 'table1' }],
    ]);
    type SingleEmbeddedQuery = GetQueryToResponse<typeof qSingleEmbedded>;
    expect(qSingleEmbedded.toObject().select).toMatchObject([
      'id',
      {
        query: { tableName: 'test_table', select: ['id'] },
        modifier: { name: 'table1' },
      },
    ]);
    assert<
      Equals<
        SingleEmbeddedQuery,
        { rows: { id: number; table1: { id: number } }[] }
      >
    >();
    expect(qSingleEmbedded.toString({ encoded: false })).toBe(
      'select=id,table1:test_table(id)',
    );
  });

  it('invalid select', () => {
    //@ts-expect-error invalid select
    const q = query.select(1);
    expect(() => q.toObject()).toThrow('Invalid select');
    expect(() => q.toString()).toThrow('Invalid select');
  });
});
