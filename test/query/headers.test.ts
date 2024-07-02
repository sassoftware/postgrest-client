import { describe, expect, it } from 'vitest';
import { Equals, assert } from 'tsafe';

import { GetQueryToResponse } from '../../src/types';
import { Query } from '../../src/query';
import DB from './test-db';

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
      expect(query.schema('test_schema').toObject().schema).toBe('test_schema');
    });
  });
});
