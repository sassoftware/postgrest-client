import { describe, expect, it } from 'vitest';

import { HORIZONTAL_FILTERS, Query } from '../../src/query';
import DB from './test-db';

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
        .or((q) => [q.eq('id', 14), q.and([q.gte('id', 11), q.lte('id', 17)])])
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
      expect(q.toString({ encoded: false })).toBe('and=(id.gt.1,col1.eq.test)');
      expect(q.toString()).toBe('and=%28id.gt.1%2Ccol1.eq.test%29');
    });

    it('or', () => {
      const q = query.or([query.gt('id', 1), query.eq('col1', 'test')]);
      expect(q.toString({ encoded: false })).toBe('or=(id.gt.1,col1.eq.test)');
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
        expect(query.not.in('id', [1, 2, 3]).toString({ encoded: false })).toBe(
          'id=not.in.(1,2,3)',
        );
      });
    });
  });

  describe('logical operators parameter type', () => {
    it('and', () => {
      expect(query.and([query.gt('id', 1), query.eq('col1', 'test')])).toEqual(
        query.and((q) => [q.gt('id', 1), q.eq('col1', 'test')]),
      );
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
        expect(query.is('json_column', null).toString({ encoded: false })).toBe(
          'json_column=is.null',
        );
      });

      // @ts-expect-error dissalow null in other filters
      query.in('nullable', [null]).toString({ encoded: false });
      // @ts-expect-error dissalow null in other filters
      query.eq('nullable', null).toString({ encoded: false });
    });
  });
});
