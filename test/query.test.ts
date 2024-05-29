/*
Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/

import { describe, expect, it } from 'vitest';
import { assert, Equals } from 'tsafe';

import { HORIZONTAL_FILTERS, Query } from '../src/query';
import { GetQueryToResponse, PostgresTable } from '../src/types';

describe('Query', () => {
  type TestTable = PostgresTable<{ id: number; col1: string }, 'id'>;
  type TestTable2 = PostgresTable<{ id: number; table1_id: number }, 'id'>;
  type JsonTestTable = PostgresTable<{
    id: number;
    // NOTE: this could be JSON, but this could also be a composite column
    json_column: { someVal: number };
    array_composite: number[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    json_column2: any;
  }>;
  type NullsTable = PostgresTable<{
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    json_column: any | null;
    nullable: string | null;
  }>;
  type DB = {
    test_table: TestTable;
    test_table2: TestTable2;
    json_test_table: JsonTestTable;
    nulls_table: NullsTable;
  };

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

  describe('horizontal filtering', () => {
    const simpleHorizontalFilters = HORIZONTAL_FILTERS.filter(
      (filter) => filter !== 'in' && filter !== 'is',
    ) as Exclude<(typeof HORIZONTAL_FILTERS)[number], 'in' | 'is'>[];
    const query = new Query<DB, 'test_table'>({ tableName: 'test_table' });

    describe('toObject', () => {
      it.each(simpleHorizontalFilters)('%s', (method) => {
        expect(query[method]('id', 1).toObject()[method]).toEqual([
          ['id', 1, false],
        ]);
        expect(query[method]('col1', '1').toObject()[method]).toEqual([
          ['col1', '1', false],
        ]);
        expect(
          query[method]('id', 1)[method]('col1', '1').toObject()[method],
        ).toEqual([
          ['id', 1, false],
          ['col1', '1', false],
        ]);
      });

      it('in', () => {
        expect(query.in('col1', ['val1', 'val2']).toObject().in).toEqual([
          ['col1', ['val1', 'val2'], false],
        ]);
        expect(
          query.in('col1', ['val1', 'val2']).in('id', [1, 2]).toObject().in,
        ).toEqual([
          ['col1', ['val1', 'val2'], false],
          ['id', [1, 2], false],
        ]);
      });

      it('multiple filters', () => {
        const qObj = query
          .gt('id', 5)
          .lt('id', 15)
          .in('col1', ['val1', 'val2'])
          .toObject();
        expect(qObj.gt).toEqual([['id', 5, false]]);
        expect(qObj.lt).toEqual([['id', 15, false]]);
        expect(qObj.in).toEqual([['col1', ['val1', 'val2'], false]]);
      });

      it('and', () => {
        const qObj = query
          .and([query.gt('id', 1), query.eq('col1', 'test')])
          .toObject();
        expect(qObj.and[0][0][0].gt).toEqual([['id', 1, false]]);
        expect(qObj.and[0][0][1].eq).toEqual([['col1', 'test', false]]);
      });

      it('or', () => {
        const qObj = query
          .or([query.gt('id', 1), query.eq('col1', 'test')])
          .toObject();
        expect(qObj.or[0][0][0].gt).toEqual([['id', 1, false]]);
        expect(qObj.or[0][0][1].eq).toEqual([['col1', 'test', false]]);
      });

      it('nested "and" and "or"', () => {
        const qObj = query
          .or((q) => [
            q.eq('id', 14),
            q.and([q.gte('id', 11), q.lte('id', 17)]),
          ])
          .toObject();
        expect(qObj.and).toHaveLength(0);
        expect(qObj.or).toHaveLength(1);
        expect(qObj.or[0][0]).toHaveLength(2);
        expect(qObj.or[0][0][0].eq).toEqual([['id', 14, false]]);
        expect(qObj.or[0][0][1].or).toHaveLength(0);
        expect(qObj.or[0][0][1].and[0][0]).toHaveLength(2);
        expect(qObj.or[0][0][1].and[0][0][0].gte).toEqual([['id', 11, false]]);
        expect(qObj.or[0][0][1].and[0][0][1].lte).toEqual([['id', 17, false]]);
      });
    });

    describe('toString', () => {
      it.each(simpleHorizontalFilters)('%s', (method) => {
        expect(query[method]('id', 1).toString()).toBe(`id=${method}.1`);
        expect(query[method]('col1', 'test').toString()).toBe(
          `col1=${method}.test`,
        );

        expect(query[method]('id', 1)[method]('col1', 'test').toString()).toBe(
          `id=${method}.1&col1=${method}.test`,
        );
      });

      it('in', () => {
        const q1 = query.in('col1', ['val1', 'val2']);
        expect(q1.toString()).toEqual('col1=in.%28val1%2Cval2%29');
        expect(q1.toString({ encoded: false })).toEqual('col1=in.(val1,val2)');

        const q2 = query.in('col1', ['val1', 'val2']).in('id', [1, 2]);
        expect(q2.toString()).toEqual(
          'col1=in.%28val1%2Cval2%29&id=in.%281%2C2%29',
        );
        expect(q2.toString({ encoded: false })).toEqual(
          'col1=in.(val1,val2)&id=in.(1,2)',
        );
      });

      it('multiple filters', () => {
        const q = query.gt('id', 5).lt('id', 15).in('col1', ['val1', 'val2']);
        expect(q.toString()).toBe('id=gt.5&id=lt.15&col1=in.%28val1%2Cval2%29');
        expect(q.toString({ encoded: false })).toBe(
          'id=gt.5&id=lt.15&col1=in.(val1,val2)',
        );
      });

      it('filter combination', () => {
        expect(query.eq('col1', 'test').gte('id', 5).toString()).toBe(
          'col1=eq.test&id=gte.5',
        );
        expect(
          query.gt('id', 5).lte('id', 15).neq('col1', 'test').toString(),
        ).toBe('id=gt.5&id=lte.15&col1=neq.test');
      });

      it('and', () => {
        // NOTE: this might not be the best example since all root
        // filters are by default "and"
        const q = query.and([query.gt('id', 1), query.eq('col1', 'test')]);
        expect(q.toString({ encoded: false })).toBe(
          'and=(id.gt.1,col1.eq.test)',
        );
        expect(q.toString()).toBe('and=%28id.gt.1%2Ccol1.eq.test%29');
      });

      it('or', () => {
        const q = query.or([query.gt('id', 1), query.eq('col1', 'test')]);
        expect(q.toString({ encoded: false })).toBe(
          'or=(id.gt.1,col1.eq.test)',
        );
        expect(q.toString()).toBe('or=%28id.gt.1%2Ccol1.eq.test%29');
      });

      it('nested "and" and "or"', () => {
        const q = query.or((q) => [
          q.eq('id', 1),
          q.and([q.gte('id', 11), q.lte('id', 17)]),
        ]);
        expect(q.toString({ encoded: false })).toBe(
          'or=(id.eq.1,and(id.gte.11,id.lte.17))',
        );
        expect(q.toString()).toBe(
          'or=%28id.eq.1%2Cand%28id.gte.11%2Cid.lte.17%29%29',
        );
      });

      describe('encoding', () => {
        it('whitespace', () => {
          const q = query.eq('col1', 'test test');
          expect(q.toString()).toBe('col1=eq.test+test');
          expect(q.toString({ encoded: false })).toBe('col1=eq.test+test');
        });

        it('plus sign (+)', () => {
          const q = query.eq('col1', 'test+test');
          expect(q.toString()).toBe('col1=eq.test%2Btest');
          expect(q.toString({ encoded: false })).toBe('col1=eq.test+test');
        });

        it('other', () => {
          const q1 = query.eq('col1', 'Günter');
          expect(q1.toString()).toBe('col1=eq.G%C3%BCnter');
          expect(q1.toString({ encoded: false })).toBe('col1=eq.Günter');

          const q2 = query.eq('col1', '👌🏻');
          expect(q2.toString()).toBe('col1=eq.%F0%9F%91%8C%F0%9F%8F%BB');
          expect(q2.toString({ encoded: false })).toBe('col1=eq.👌🏻');
        });
      });

      describe('not', () => {
        it('simple', () => {
          // should return 4, 3, 2
          expect(
            query.not.eq('id', 1).lt('id', 5).toString({ encoded: false }),
          ).toBe('id=not.eq.1&id=lt.5');
        });

        it('logical operator', () => {
          expect(
            // should return 7, 4, 3, 2
            query
              .or((q) => [
                q.eq('id', 7),
                q.not.or([q.eq('id', 1), q.gte('id', 5)]),
              ])
              .toString({ encoded: false }),
          ).toBe('or=(id.eq.7,not.or(id.eq.1,id.gte.5))');
        });

        it('combined logical', () => {
          const q = query.not
            .or([query.eq('id', 1), query.eq('id', 2)])
            .or([query.lt('id', 5), query.gt('id', 10)]);
          expect(q.toString({ encoded: false })).toBe(
            'not.or=(id.eq.1,id.eq.2)&or=(id.lt.5,id.gt.10)',
          );
        });

        it('array filters', () => {
          expect(
            query.not.in('id', [1, 2, 3]).toString({ encoded: false }),
          ).toBe('id=not.in.(1,2,3)');
        });
      });
    });

    describe('logical operators parameter type', () => {
      it('and', () => {
        expect(
          query.and([query.gt('id', 1), query.eq('col1', 'test')]),
        ).toEqual(query.and((q) => [q.gt('id', 1), q.eq('col1', 'test')]));
      });

      it('or', () => {
        expect(query.or([query.gt('id', 1), query.eq('col1', 'test')])).toEqual(
          query.or((q) => [q.gt('id', 1), q.eq('col1', 'test')]),
        );
      });
    });

    describe('JSON filtering', () => {
      const query = new Query<DB, 'json_test_table'>({
        tableName: 'json_test_table',
      });

      it.each(simpleHorizontalFilters)('%s', (method) => {
        expect(
          query[method]('json_column->val', 1).toString({ encoded: false }),
        ).toBe(`json_column->val=${method}.1`);
        expect(
          query[method]('json_column->>val', '1').toString({ encoded: false }),
        ).toBe(`json_column->>val=${method}.1`);
        expect(
          query[method]('json_column2->val', 1).toString({ encoded: false }),
        ).toBe(`json_column2->val=${method}.1`);
        expect(
          query[method]('json_column2->VAL', 1).toString({ encoded: false }),
        ).toBe(`json_column2->VAL=${method}.1`);

        expect(
          query[method]('json_column->val1', 1)
            [method]('json_column->>val1', '1')
            [method]('json_column->val2', 'test')
            .toString({ encoded: false }),
        ).toBe(
          `json_column->val1=${method}.1&json_column->>val1=${method}.1&json_column->val2=${method}.test`,
        );
      });

      it('multiple filters', () => {
        // @ts-expect-error make sure it doesn't accept wrong type
        query.gt('id', '5');
        // @ts-expect-error don't allow on JSON columns
        query.gt('json_column', '5');
        // this is fine - json_column2 has `any` type
        query.gt('json_column2', '5');
        // @ts-expect-error don't allow on JSON columns
        query.gt('json_column', 5);
        // this is fine - json_column2 has `any` type
        query.gt('json_column2', 5);
        // @ts-expect-error make sure it doesn't accept wrong type
        query.gt('non_existing->test', 5);
        // @ts-expect-error make sure it doesn't accept wrong type
        query.gt('non_existing->>test', 5);
        // NOTE: limit fields with `->>` to only strings
        // @ts-expect-error make sure it doesn't accept wrong type
        query.gt('json_column->>num_val', 5);
        const q = query
          .gt('id', 5)
          .lt('id', 15)
          .gt('json_column->num_val', 1)
          .gt('json_column->>num_val', '1')
          .in('json_column->val1', ['val1', 'val2']);
        expect(q.toString({ encoded: false })).toBe(
          'id=gt.5&json_column->num_val=gt.1&json_column->>num_val=gt.1&id=lt.15&json_column->val1=in.(val1,val2)',
        );
      });

      describe('nulls support', () => {
        const query = new Query<DB, 'nulls_table'>({
          tableName: 'nulls_table',
        });

        it('json property', () => {
          expect(
            query.is('json_column->val', null).toString({ encoded: false }),
          ).toBe('json_column->val=is.null');
        });

        it('json object', () => {
          expect(
            query.is('json_column', null).toString({ encoded: false }),
          ).toBe('json_column=is.null');
        });

        // @ts-expect-error dissalow null in other filters
        query.in('nullable', [null]).toString({ encoded: false });
        // @ts-expect-error dissalow null in other filters
        query.eq('nullable', null).toString({ encoded: false });
      });
    });
  });

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

  describe('headers', () => {
    const query = new Query<DB, 'test_table'>({ tableName: 'test_table' });

    describe('toObject', () => {
      it('single', () => {
        expect(query.toObject().cardinality).toBe('many');
        expect(query.single().toObject().cardinality).toBe('one');

        type MultiRowResponse = GetQueryToResponse<typeof query>;
        type MultiRowResponseExpected = {
          rows: DB['test_table']['get'][];
        };
        assert<Equals<MultiRowResponse, MultiRowResponseExpected>>();

        const singleQuery = query.single();
        type SingleRowResponse = GetQueryToResponse<typeof singleQuery>;
        type SingleRowResponseExpected = {
          row: DB['test_table']['get'];
        };
        assert<Equals<SingleRowResponse, SingleRowResponseExpected>>();
      });

      it('count', () => {
        const exactCount = query.count('exact');
        const plannedCount = query.count('planned');
        const estimatedCount = query.count('estimated');

        expect(query.toObject().count).toBeUndefined();
        expect(exactCount.toObject().count).toBe('exact');
        expect(plannedCount.toObject().count).toBe('planned');
        expect(estimatedCount.toObject().count).toBe('estimated');

        type NoCountResponseExpected = { rows: DB['test_table']['get'][] };
        type ResponseWithCountExpected = {
          rows: DB['test_table']['get'][];
          pagesLength: number;
          totalLength: number;
        };

        type NoCountResponse = GetQueryToResponse<typeof query>;
        assert<Equals<NoCountResponse, NoCountResponseExpected>>();

        type ExactCountResponse = GetQueryToResponse<typeof exactCount>;
        assert<Equals<ExactCountResponse, ResponseWithCountExpected>>();

        type PlannedCountResponse = GetQueryToResponse<typeof plannedCount>;
        assert<Equals<PlannedCountResponse, ResponseWithCountExpected>>();

        type EstimatedCountResponse = GetQueryToResponse<typeof estimatedCount>;
        assert<Equals<EstimatedCountResponse, ResponseWithCountExpected>>();
      });

      it('returning', () => {
        expect(query.toObject().returning).toBeUndefined();
        expect(query.returning('minimal').toObject().returning).toBe('minimal');
        expect(query.returning('headers-only').toObject().returning).toBe(
          'headers-only',
        );
        expect(query.returning('representation').toObject().returning).toBe(
          'representation',
        );
      });

      it('onConflict', () => {
        expect(query.toObject().onConflict).toBeUndefined();
        expect(query.toObject().resolution).toBeUndefined();

        const q1 = query.onConflict('merge-duplicates');
        expect(q1.toObject().resolution).toBe('merge-duplicates');
        expect(q1.toObject().onConflict).toBeUndefined();

        const q2 = query.onConflict('ignore-duplicates');
        expect(q2.toObject().resolution).toBe('ignore-duplicates');
        expect(q2.toObject().onConflict).toBeUndefined();

        const q3 = query.onConflict('merge-duplicates', 'id');
        expect(q3.toObject().resolution).toBe('merge-duplicates');
        expect(q3.toObject().onConflict).toBe('id');
      });

      it('missing', () => {
        expect(query.toObject().missing).toBeUndefined();
        expect(query.missing('default').toObject().missing).toBe('default');
      });

      it('schema', () => {
        expect(query.toObject().schema).toBeUndefined();
        expect(query.schema('test_schema').toObject().schema).toBe(
          'test_schema',
        );
      });
    });
  });

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
        Equals<
          StarAndColumnArrayQuery,
          { rows: { id: number; col1: string }[] }
        >
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
      type IdAllFromEmbedded2Query = GetQueryToResponse<
        typeof qAllFromEmbedded2
      >;
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

    describe('multi level nesting', () => {
      const q1 = new Query<DB, 'test_table'>({ tableName: 'test_table' });
      const q2 = new Query<DB, 'test_table2'>({ tableName: 'test_table2' });

      // NOTE: this is not a real world scenario since we are here testing
      // with only 2 tables
      type NestedQueryExpected = {
        rows: {
          id: number;
          test_table2: {
            id: number;
            table1_id: number;
            test_table: {
              id: number;
              col1: string;
            }[];
          }[];
        }[];
      };

      const expectedObj = {
        select: [
          'id',
          {
            tableName: 'test_table2',
            select: ['*', { tableName: 'test_table', select: ['*'] }],
          },
        ],
      };

      it('chained', () => {
        const qNested = q1
          .select('id')
          .select(q2.select('*').select(q1.select('*')));
        type NestedQuery = GetQueryToResponse<typeof qNested>;
        expect(qNested.toObject()).toMatchObject(expectedObj);
        assert<Equals<NestedQuery, NestedQueryExpected>>();
        expect(qNested.toString({ encoded: false })).toBe(
          'select=id,test_table2(*,test_table(*))',
        );
      });

      it.todo('array', () => {
        const qNested2 = q1.select(['id', q2.select(['*', q1.select('*')])]);
        type NestedQuery2 = GetQueryToResponse<typeof qNested2>;
        expect(qNested2.toObject()).toMatchObject(expectedObj);
        // TODO: known issue - we should try to fix it (workaround in the test above)
        // the problem here is that TypeScript can only get the last intersection in inference
        // example: `Gen<infer T>` in case of `T` being `'a' & 'b'`, TypeScript will only infer `'b'`
        assert<Equals<NestedQuery2, NestedQueryExpected>>(
          false,
          'This is currently not working properly.',
        );
        expect(qNested2.toString({ encoded: false })).toBe(
          'select=id,test_table2(*,test_table(*))',
        );
      });
    });

    describe('with horizontal filtering', () => {
      const q1 = new Query<DB, 'test_table'>({ tableName: 'test_table' });
      const q2 = new Query<DB, 'test_table2'>({ tableName: 'test_table2' });

      it('simple embedded filters', () => {
        const query = q1.select(['*', q2.eq('id', 1)]);
        expect(query.toObject()).toMatchObject({
          tableName: 'test_table',
          select: ['*', { tableName: 'test_table2', eq: [['id', 1, false]] }],
        });
        expect(query.toString({ encoded: false })).toBe(
          'select=*,test_table2()&test_table2.id=eq.1',
        );

        const queryIn = q1.select(['*', q2.in('id', [1, 2])]);
        expect(queryIn.toObject()).toMatchObject({
          tableName: 'test_table',
          select: [
            '*',
            { tableName: 'test_table2', in: [['id', [1, 2], false]] },
          ],
        });
        expect(queryIn.toString({ encoded: false })).toBe(
          'select=*,test_table2()&test_table2.id=in.(1,2)',
        );
      });

      it('order', () => {
        const query = q1.select(['*', q2.order([{ column: 'id' }])]);
        expect(query.toObject()).toMatchObject({
          tableName: 'test_table',
          select: [
            '*',
            { tableName: 'test_table2', order: [{ column: 'id' }] },
          ],
        });
        expect(query.toString({ encoded: false })).toBe(
          'select=*,test_table2()&test_table2.order=id',
        );
      });

      it('order with rename', () => {
        const query = q2.select([
          '*',
          [q1.select('*').order([{ column: 'col1' }]), { name: 'r' }],
        ]);
        expect(query.toString({ encoded: false })).toBe(
          'select=*,r:test_table(*)&r.order=col1',
        );
      });

      it('limit and offset', () => {
        const query = q1.select(['*', q2.limit(10).offset(10)]);
        expect(query.toObject()).toMatchObject({
          tableName: 'test_table',
          select: ['*', { tableName: 'test_table2', limit: 10, offset: 10 }],
        });
        expect(query.toString({ encoded: false })).toBe(
          'select=*,test_table2()&test_table2.limit=10&test_table2.offset=10',
        );
      });

      it('limit and offset with rename', () => {
        const query = q1.select([
          '*',
          [q2.limit(10).offset(10), { name: 'r' }],
        ]);
        expect(query.toString({ encoded: false })).toBe(
          'select=*,r:test_table2()&r.limit=10&r.offset=10',
        );
      });

      it('aliased (renamed) embedded filters', () => {
        const query = q1.select([
          '*',
          [q2.select('*').eq('id', 1), { name: 'r1' }],
          [q2.select('*').eq('id', 2), { name: 'r2' }],
        ]);
        expect(query.toString({ encoded: false })).toBe(
          'select=*,r1:test_table2(*),r2:test_table2(*)&r1.id=eq.1&r2.id=eq.2',
        );
      });

      it('multi level nesting', () => {
        const query = q1.select([
          '*',
          q2.select(['*', q1.select('*').eq('id', 1)]),
        ]);
        expect(query.toString({ encoded: false })).toBe(
          'select=*,test_table2(*,test_table(*))&test_table2.test_table.id=eq.1',
        );

        const queryIn = q1.select([
          '*',
          q2.select(['*', q1.select('*').in('id', [1, 2])]),
        ]);
        expect(queryIn.toString({ encoded: false })).toBe(
          'select=*,test_table2(*,test_table(*))&test_table2.test_table.id=in.(1,2)',
        );
      });

      it('multi level nesting with rename', () => {
        const query = q1.select([
          '*',
          [
            q2.select(['*', [q1.select('*').eq('id', 1), { name: 'n2' }]]),
            { name: 'n1' },
          ],
        ]);
        expect(query.toString({ encoded: false })).toBe(
          'select=*,n1:test_table2(*,n2:test_table(*))&n1.n2.id=eq.1',
        );

        const queryIn = q1.select([
          '*',
          [
            q2.select(['*', [q1.select('*').in('id', [1, 2]), { name: 'n2' }]]),
            { name: 'n1' },
          ],
        ]);
        expect(queryIn.toString({ encoded: false })).toBe(
          'select=*,n1:test_table2(*,n2:test_table(*))&n1.n2.id=in.(1,2)',
        );
      });

      it('logical operators', () => {
        const query = q1
          .select([
            '*',
            q2.select('*').or((q) => [q.eq('id', 1), q.eq('id', 2)]),
          ])
          .or((q) => [q.eq('id', 3), q.eq('id', 4)]);
        expect(query.toString({ encoded: false })).toBe(
          'select=*,test_table2(*)&or=(id.eq.3,id.eq.4)&test_table2.or=(id.eq.1,id.eq.2)',
        );
      });

      it('logical operators with embedded filters (or)', () => {
        const query = q1
          .select(['*', q2.select('*').eq('id', 1)])
          .neq('id', 3)
          .or((q) => [q.gt('id', 2), q.lt('id', 5)]);
        expect(query.toString({ encoded: false })).toBe(
          'select=*,test_table2(*)&id=neq.3&test_table2.id=eq.1&or=(id.gt.2,id.lt.5)',
        );
      });

      it('logical operators with embedded filters (and)', () => {
        const query = q1
          .select(['*', q2.select('*').eq('id', 1)])
          .neq('id', 3)
          .and((q) => [q.gt('id', 2), q.lt('id', 5)]);
        expect(query.toString({ encoded: false })).toBe(
          'select=*,test_table2(*)&id=neq.3&test_table2.id=eq.1&and=(id.gt.2,id.lt.5)',
        );
      });

      it('logical operators with rename', () => {
        const query = q1
          .select([
            '*',
            [
              q2.select('*').or((q) => [q.eq('id', 1), q.eq('id', 2)]),
              { name: 'r' },
            ],
          ])
          .or((q) => [q.eq('id', 3), q.eq('id', 4)]);
        expect(query.toString({ encoded: false })).toBe(
          'select=*,r:test_table2(*)&or=(id.eq.3,id.eq.4)&r.or=(id.eq.1,id.eq.2)',
        );

        const query2 = q1.select([
          '*',
          [
            q2.select('*').or((q) => [q.gt('id', 10), q.in('id', [1, 5])]),
            { name: 'r' },
          ],
        ]);
        expect(query2.toString({ encoded: false })).toBe(
          'select=*,r:test_table2(*)&r.or=(id.gt.10,id.in.(1,5))',
        );
      });

      it('logical operators with not', () => {
        const query = q1.select([
          '*',
          q2
            .select('*')
            .and((q) => [q.not.eq('id', 1), q.not.in('id', [2, 5])]),
        ]);
        expect(query.toString({ encoded: false })).toBe(
          'select=*,test_table2(*)&test_table2.and=(id.not.eq.1,id.not.in.(2,5))',
        );

        const query2 = q1.select([
          '*',
          q2.select('*').not.or((q) => [q.eq('id', 1), q.in('id', [2, 5])]),
        ]);
        expect(query2.toString({ encoded: false })).toBe(
          'select=*,test_table2(*)&test_table2.not.or=(id.eq.1,id.in.(2,5))',
        );
      });

      it.todo('top level filtering (!inner)', () => {
        // TODO: needs a way to tell it to do top level filtering
        const query = q1.select(['*', q2.select('*').eq('id', 1)]);
        expect(query.toObject()).toMatchObject({
          tableName: 'test_table',
          select: ['*', { tableName: 'test_table2', eq: [['id', 1, false]] }],
        });
        expect(query.toString({ encoded: false })).toBe(
          'select=*,test_table2!inner(*)&test_table2.id=eq.1',
        );
      });

      describe('top level ordering', () => {
        it('simple', () => {
          const query = q1.select([
            '*',
            q2.select('*').order([{ column: 'id', top: true }]),
          ]);
          expect(query.toString({ encoded: false })).toBe(
            'select=*,test_table2(*)&order=test_table2(id)',
          );
        });

        it('simple desc', () => {
          const query = q1.select([
            '*',
            q2.select('*').order([{ column: 'id', top: true, order: 'desc' }]),
          ]);
          expect(query.toString({ encoded: false })).toBe(
            'select=*,test_table2(*)&order=test_table2(id).desc',
          );
        });

        it('with rename', () => {
          const query = q1.select([
            '*',
            [
              q2
                .select('*')
                .order([{ column: 'id', top: true, order: 'desc' }]),
              { name: 't2' },
            ],
          ]);
          expect(query.toString({ encoded: false })).toBe(
            'select=*,t2:test_table2(*)&order=t2(id).desc',
          );
        });

        it('multiple', () => {
          const query = q1.select([
            '*',
            q2.select('*').order([
              { column: 'id', top: true },
              { column: 'table1_id', top: true },
            ]),
          ]);
          expect(query.toString({ encoded: false })).toBe(
            'select=*,test_table2(*)&order=test_table2(id),test_table2(table1_id)',
          );
        });

        it('combination', () => {
          const query = q1.select([
            '*',
            q2
              .select('*')
              .order([{ column: 'id', top: true }, { column: 'table1_id' }]),
          ]);
          expect(query.toString({ encoded: false })).toBe(
            'select=*,test_table2(*)&order=test_table2(id)&test_table2.order=table1_id',
          );
        });

        it('multi level nesting', () => {
          const query = q1.select('*').select(
            q2
              .select('*')
              .order([{ column: 'id', top: true }])
              .select(q1.select('*').order([{ column: 'id', top: true }])),
          );
          expect(query.toString({ encoded: false })).toBe(
            'select=*,test_table2(*,test_table(*))&order=test_table2(id),test_table2(test_table(id))',
          );
        });

        it('weighted', () => {
          const query = q1
            .select(['*', q2.select('*').order([{ column: 'id', top: true }])])
            .order([{ column: 'id', weight: 1 }]);
          expect(query.toString({ encoded: false })).toBe(
            'select=*,test_table2(*)&order=id,test_table2(id)',
          );

          const query2 = q1
            .select([
              '*',
              q2.select('*').order([{ column: 'id', top: true, weight: 1 }]),
            ])
            .order([{ column: 'id' }]);
          expect(query2.toString({ encoded: false })).toBe(
            'select=*,test_table2(*)&order=test_table2(id),id',
          );
        });
      });

      // https://postgrest.org/en/stable/references/api/resource_embedding.html#null-filtering-on-embedded-resources
      it.todo('null filtering');
    });

    it('invalid select', () => {
      //@ts-expect-error invalid select
      const q = query.select(1);
      expect(() => q.toObject()).toThrow('Invalid select');
      expect(() => q.toString()).toThrow('Invalid select');
    });

    describe('JSON filtering', () => {
      const query = new Query<DB, 'json_test_table'>({
        tableName: 'json_test_table',
      });

      // error types
      // @ts-expect-error don't allow -> in .select
      query.select('json_column->test');
      // @ts-expect-error don't allow -> in .select
      query.select('json_column->test->test');
      // this is fine (returning string with ->>)
      query.select('json_column->test->>test');
      // @ts-expect-error don't allow columns that don't exist
      query.select('non_existing->>test');
      // @ts-expect-error don't allow columns that don't exist
      query.selectJson('non_existing->>test');
      // @ts-expect-error don't allow columns that don't exist
      query.select('non_existing->test');
      // @ts-expect-error don't allow columns that don't exist
      query.selectJson('non_existing->test');

      // allow ->> only in .select
      query.select('json_column->>test');
      // @ts-expect-error don't allow ->> in .selectJson
      query.selectJson('json_column->>test');
      // @ts-expect-error don't allow ->> in .selectJson
      query.selectJson('json_column->>Test');
      // @ts-expect-error don't allow ->> in .selectJson
      query.selectJson(['json_column->>test', 'json_column->>test2']);

      it('simple string', () => {
        // @ts-expect-error invalid select
        query.select('invalid->json_property1');

        const qIdAndFullJson = query.select('id').selectJson<{
          json_column: { json_property1: string };
        }>('json_column');
        type IdAndFullJson = GetQueryToResponse<typeof qIdAndFullJson>;
        expect(qIdAndFullJson.toObject().select).toEqual(['id', 'json_column']);
        assert<
          Equals<
            IdAndFullJson,
            { rows: { id: number; json_column: { json_property1: string } }[] }
          >
        >();
        expect(qIdAndFullJson.toString({ encoded: false })).toBe(
          'select=id,json_column',
        );

        const qIdAndJsonCol = query.select('id').selectJson<{
          json_property1: string;
        }>('json_column->json_property1');
        type IdAndJsonCol = GetQueryToResponse<typeof qIdAndJsonCol>;
        expect(qIdAndJsonCol.toObject().select).toEqual([
          'id',
          'json_column->json_property1',
        ]);
        assert<
          Equals<
            IdAndJsonCol,
            { rows: { id: number; json_property1: string }[] }
          >
        >();
        expect(qIdAndJsonCol.toString({ encoded: false })).toBe(
          'select=id,json_column->json_property1',
        );

        const qJsonCol = query.selectJson<{ json_property1: string }>(
          'json_column->json_property1',
        );
        type JsonCol = GetQueryToResponse<typeof qJsonCol>;
        expect(qJsonCol.toObject().select).toEqual([
          'json_column->json_property1',
        ]);
        assert<Equals<JsonCol, { rows: { json_property1: string }[] }>>();
        expect(qJsonCol.toString({ encoded: false })).toBe(
          'select=json_column->json_property1',
        );

        const starOnly = query.select('*');
        type StarOnlyQuery = GetQueryToResponse<typeof starOnly>;
        expect(starOnly.toObject().select).toEqual(['*']);
        assert<
          Equals<
            StarOnlyQuery,
            {
              rows: {
                id: number;
                json_column: { someVal: number };
                array_composite: number[];
                // NOTE: converted `unknown` to `any` for ease of use
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                json_column2: any;
              }[];
            }
          >
        >();
        expect(starOnly.toString({ encoded: false })).toBe('select=*');

        // NOTE: PostgREST is ignoring column selectors when "*" is included.
        const starAndColumn = query.select('*').select('id');
        type StarAndColumnQuery = GetQueryToResponse<typeof starAndColumn>;
        expect(starAndColumn.toObject().select).toEqual(['*', 'id']);
        assert<
          Equals<
            StarAndColumnQuery,
            {
              rows: {
                id: number;
                json_column: { someVal: number };
                array_composite: number[];
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                json_column2: any;
              }[];
            }
          >
        >();
        expect(starAndColumn.toString({ encoded: false })).toBe('select=*,id');
      });

      it('array', () => {
        const qJsonMulti = query.selectJson<{
          json_property1: string;
          json_property2: number;
        }>(['json_column->json_property1', 'json_column->json_property2']);
        type JsonMulti = GetQueryToResponse<typeof qJsonMulti>;
        expect(qJsonMulti.toObject().select).toEqual([
          'json_column->json_property1',
          'json_column->json_property2',
        ]);
        assert<
          Equals<
            JsonMulti,
            { rows: { json_property1: string; json_property2: number }[] }
          >
        >();
        expect(qJsonMulti.toString({ encoded: false })).toBe(
          'select=json_column->json_property1,json_column->json_property2',
        );

        const qJsonMultiWithId = query.select('id').selectJson<{
          json_property1: string;
          json_property2: number;
        }>(['json_column->json_property1', 'json_column->json_property2']);
        type JsonMultiWithId = GetQueryToResponse<typeof qJsonMultiWithId>;
        expect(qJsonMultiWithId.toObject().select).toEqual([
          'id',
          'json_column->json_property1',
          'json_column->json_property2',
        ]);
        assert<
          Equals<
            JsonMultiWithId,
            {
              rows: {
                id: number;
                json_property1: string;
                json_property2: number;
              }[];
            }
          >
        >();
        expect(qJsonMultiWithId.toString({ encoded: false })).toBe(
          'select=id,json_column->json_property1,json_column->json_property2',
        );
      });

      it.todo('without type generic', () => {
        const qJsonMulti = query.selectJson([
          'json_column->json_property1',
          'json_column->json_property2',
        ]);
        type JsonMulti = GetQueryToResponse<typeof qJsonMulti>;
        expect(qJsonMulti.toObject().select).toEqual(['id']);
        // TODO: implement!
        assert<
          Equals<
            JsonMulti,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            { rows: { json_property1: any; json_property2: any }[] }
          >
        >(false, 'This is currently not working properly.');
        expect(qJsonMulti.toString({ encoded: false })).toBe(
          'select=json_column->json_property1,json_column->json_property2',
        );
      });

      it('string selection', () => {
        const qSingleWithId = query
          .select('id')
          .select('json_column2->>someVal')
          .select('json_column2->anObj->>someOtherVal');
        type SingleWithId = GetQueryToResponse<typeof qSingleWithId>;
        expect(qSingleWithId.toObject().select).toEqual([
          'id',
          'json_column2->>someVal',
          'json_column2->anObj->>someOtherVal',
        ]);
        assert<
          Equals<
            SingleWithId,
            { rows: { id: number; someVal: string; someOtherVal: string }[] }
          >
        >();
        expect(qSingleWithId.toString({ encoded: false })).toBe(
          'select=id,json_column2->>someVal,json_column2->anObj->>someOtherVal',
        );

        const qMultiWithId = query.select([
          'id',
          'json_column2->>someVal',
          'json_column2->anObj->>someOtherVal',
        ]);
        type MultiWithId = GetQueryToResponse<typeof qMultiWithId>;
        expect(qMultiWithId.toObject().select).toEqual([
          'id',
          'json_column2->>someVal',
          'json_column2->anObj->>someOtherVal',
        ]);
        assert<
          Equals<
            MultiWithId,
            { rows: { id: number; someVal: string; someOtherVal: string }[] }
          >
        >();
        expect(qMultiWithId.toString({ encoded: false })).toBe(
          'select=id,json_column2->>someVal,json_column2->anObj->>someOtherVal',
        );
      });
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
});
