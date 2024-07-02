import axios from 'axios';
import { describe, expect, it } from 'vitest';
import { Equals, assert } from 'tsafe';

import { PostgrestClient } from '../../src/postgrest-client';
import { AlphabeticTypes, NumericTypes } from '../../src/types';
import { BASE_URL } from './constants';
import DB from './test-db';

describe.each([
  ['fetch', undefined],
  ['axios', axios.create()],
])('%s', (_name, axiosInstance) => {
  const pgClient = new PostgrestClient<DB>({ base: BASE_URL, axiosInstance });

  it.each([
    'smallint',
    'integer',
    'decimal',
    'float',
    'numeric',
    'real',
  ] as NumericTypes[])('chaining numeric "%s"', async (cast) => {
    const query = pgClient.query('competitions');
    const insertedRes = await pgClient.post({
      query: query.returning('representation').single(),
      data: { name: '100', year: 2023 },
    });

    const { row } = await pgClient.get({
      query: query
        .eq('id', insertedRes.row.id)
        .select(['name', { cast }])
        .single(),
    });

    assert<Equals<typeof row.name, number>>();
    expect(row.name).toBeTypeOf('number');
  });

  it.each(['text', 'character', 'money'] as AlphabeticTypes[])(
    'chaining alphabetic "%s"',
    async (cast) => {
      const query = pgClient.query('competitions');
      const insertedRes = await pgClient.post({
        query: query.returning('representation').single(),
        data: { name: '100', year: 2023 },
      });

      const { row } = await pgClient.get({
        query: query
          .eq('id', insertedRes.row.id)
          .select(['year', { cast }])
          .single(),
      });

      assert<Equals<typeof row.year, string>>();
      expect(row.year).toBeTypeOf('string');
    },
  );

  it('chaining alphabetic "bytea"', async () => {
    const query = pgClient.query('competitions');
    const insertedRes = await pgClient.post({
      query: query.returning('representation').single(),
      data: { name: '100', year: 2023 },
    });

    const { row } = await pgClient.get({
      query: query
        .eq('id', insertedRes.row.id)
        .select(['name', { cast: 'bytea' }])
        .single(),
    });

    assert<Equals<typeof row.name, string>>();
    expect(row.name).toBeTypeOf('string');
    expect(row.name).toBe('\\x313030');
  });

  it.each([
    'smallint',
    'integer',
    'decimal',
    'float',
    'numeric',
    'real',
  ] as NumericTypes[])('array selector numeric "%s"', async (cast) => {
    const query = pgClient.query('competitions');
    const insertedRes = await pgClient.post({
      query: query.returning('representation').single(),
      data: { name: '100', year: 2023 },
    });

    const { row } = await pgClient.get({
      query: query
        .eq('id', insertedRes.row.id)
        .select(['id', ['name', { cast }]])
        .single(),
    });

    assert<Equals<typeof row.name, number>>();
    expect(row.name).toBeTypeOf('number');
  });

  it.each(['text', 'character', 'money'] as AlphabeticTypes[])(
    'array selector alphabetic "%s"',
    async (cast) => {
      const query = pgClient.query('competitions');
      const insertedRes = await pgClient.post({
        query: query.returning('representation').single(),
        data: { name: '100', year: 2023 },
      });

      const { row } = await pgClient.get({
        query: query
          .eq('id', insertedRes.row.id)
          .select(['id', ['year', { cast }]])
          .single(),
      });

      assert<Equals<typeof row.year, string>>();
      expect(row.year).toBeTypeOf('string');
    },
  );

  it('array selector alphabetic "bytea"', async () => {
    const query = pgClient.query('competitions');
    const insertedRes = await pgClient.post({
      query: query.returning('representation').single(),
      data: { name: '100', year: 2023 },
    });

    const { row } = await pgClient.get({
      query: query
        .eq('id', insertedRes.row.id)
        .select(['id', ['name', { cast: 'bytea' }]])
        .single(),
    });

    assert<Equals<typeof row.name, string>>();
    expect(row.name).toBeTypeOf('string');
    expect(row.name).toBe('\\x313030');
  });
});
