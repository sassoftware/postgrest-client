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

  it('error', async () => {
    const query = pgClient.query('competitions');
    await expect(
      pgClient.put({
        query,
        data: { id: 1, name: 'Cannes Film Festival', year: 2023 },
      }),
    ).rejects.toMatchObject({
      message: 'Request failed with status code 405',
      status: 405,
      statusText: 'Method Not Allowed',
      data: {
        code: 'PGRST105',
        message:
          "Filters must include all and only primary key columns with 'eq' operators",
      },
    });
  });

  it('successful', async () => {
    const query = pgClient.query('competitions').eq('id', 1);
    const { status } = await pgClient.put({
      query,
      data: { id: 1, name: 'Cannes Film Festival', year: 2023 },
    });
    assert<Equals<typeof status, number>>();
    expect(status).toBe(204);
  });

  it('representation', async () => {
    const query = pgClient
      .query('competitions')
      .eq('id', 1)
      .returning('representation');
    const data = { id: 1, name: 'Cannes Film Festival', year: 2023 };
    const { status, rows } = await pgClient.put({
      query,
      data,
    });
    assert<Equals<typeof status, number>>();
    assert<Equals<typeof rows, (typeof data)[]>>();
    expect(status).toBe(200);
    expect(rows).toMatchObject([data]);
  });

  it('representation single', async () => {
    const query = pgClient
      .query('competitions')
      .eq('id', 1)
      .returning('representation')
      .single();
    const data = { id: 1, name: 'Cannes Film Festival', year: 2023 };
    const { status, row } = await pgClient.put({
      query,
      data,
    });
    assert<Equals<typeof status, number>>();
    assert<Equals<typeof row, typeof data>>();
    expect(status).toBe(200);
    expect(row).toMatchObject(data);
  });
});
