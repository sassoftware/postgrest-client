import axios from 'axios';
import { describe, expect, it } from 'vitest';
import { Equals, assert } from 'tsafe';

import { PostgrestClient } from '../../../src/postgrest-client';
import { BASE_URL } from '../constants';
import DB from '../test-db';

describe.each([
  ['fetch', undefined],
  ['axios', axios.create()],
])('%s', (_name, axiosInstance) => {
  const pgClient = new PostgrestClient<DB>({ base: BASE_URL, axiosInstance });

  it('insert then delete', async () => {
    const { row } = await pgClient.post({
      query: pgClient
        .query('competitions')
        .returning('representation')
        .single(),
      data: {
        name: 'Cannes Film Festival',
        year: 2022,
      },
    });

    const deleteQuery = pgClient.query('competitions').eq('id', row.id);
    const deleteRes = await pgClient.delete({
      query: deleteQuery,
    });

    expect(deleteRes.status).toBe(204);

    const { rows } = await pgClient.get({ query: deleteQuery });
    expect(rows).toEqual([]);
  });

  it('delete count', async () => {
    const { rows } = await pgClient.post({
      query: pgClient.query('competitions').returning('representation'),
      data: [
        {
          name: 'Cannes Film Festival',
          year: 2022,
        },
        {
          name: 'Cannes Film Festival',
          year: 2023,
        },
      ],
    });

    const { status, totalLength } = await pgClient.delete({
      query: pgClient
        .query('competitions')
        .in(
          'id',
          rows.map(({ id }) => id),
        )
        .count('exact'),
    });

    assert<Equals<typeof status, number>>();
    assert<Equals<typeof totalLength, number>>();
    expect(status).toBe(204);
    expect(totalLength).toBe(2);
  });

  it('return representation', async () => {
    const insertRes = await pgClient.post({
      query: pgClient.query('competitions').returning('representation'),
      data: [
        {
          name: 'Cannes Film Festival',
          year: 2022,
        },
        {
          name: 'Cannes Film Festival',
          year: 2023,
        },
      ],
    });

    const { status, totalLength, rows } = await pgClient.delete({
      query: pgClient
        .query('competitions')
        .in(
          'id',
          insertRes.rows.map(({ id }) => id),
        )
        .count('exact')
        .returning('representation'),
    });

    assert<Equals<typeof status, number>>();
    assert<Equals<typeof totalLength, number>>();
    expect(status).toBe(200);
    expect(totalLength).toBe(2);
    expect(insertRes.rows).toEqual(rows);
  });

  it('return representation single', async () => {
    const insertRes = await pgClient.post({
      query: pgClient
        .query('competitions')
        .returning('representation')
        .single(),
      data: {
        name: 'Cannes Film Festival',
        year: 2022,
      },
    });

    const { status, totalLength, row } = await pgClient.delete({
      query: pgClient
        .query('competitions')
        .eq('id', insertRes.row.id)
        .count('exact')
        .returning('representation')
        .select('name')
        .single(),
    });

    assert<Equals<typeof status, number>>();
    assert<Equals<typeof totalLength, number>>();
    assert<Equals<typeof row, { name: string }>>();
    expect(status).toBe(200);
    expect(totalLength).toBe(1);
    expect(row).toEqual({ name: expect.any(String) });
  });

  it('invalid call', async () => {
    expect(() =>
      pgClient.delete({
        // @ts-expect-error testing an error
        query: pgClient.query('competitions').eq('id', 'invalid value'),
      }),
    ).rejects.toThrow();
  });
});
