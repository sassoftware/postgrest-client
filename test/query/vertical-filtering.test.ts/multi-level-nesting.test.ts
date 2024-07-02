import { describe, expect, it } from 'vitest';
import { Equals, assert } from 'tsafe';

import { GetQueryToResponse } from '../../../src/types';
import { Query } from '../../../src/query';
import DB from '../test-db';

describe('vertical filtering', () => {
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
});
