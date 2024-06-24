import { describe, expect, it } from 'vitest';
import { Equals, assert } from 'tsafe';

import { GetQueryToResponse } from '../../../src/types';
import { Query } from '../../../src/query';
import DB from '../test-db';

describe('vertical filtering', () => {
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
        Equals<IdAndJsonCol, { rows: { id: number; json_property1: string }[] }>
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
