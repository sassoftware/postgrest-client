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

  it('count', async () => {
    const query = pgClient.query('actors').count('exact');
    const { pagesLength, totalLength, status } = await pgClient.head({
      query,
    });

    assert<Equals<typeof status, number>>();
    assert<Equals<typeof pagesLength, number>>();
    assert<Equals<typeof totalLength, number>>();
    expect(status).toBe(200);
    expect(pagesLength).toBe(1);
    expect(totalLength).toBe(3);
  });

  describe('errors', () => {
    it('invalid table', async () => {
      // @ts-expect-error testing an error
      const query = pgClient.query('non-existing');
      await expect(() => pgClient.head({ query })).rejects.toMatchObject({
        message: 'Request failed with status code 404',
        status: 404,
        statusText: 'Not Found',
      });
    });

    it('invalid column', async () => {
      // @ts-expect-error testing an error
      const query = pgClient.query('actors').select('invalid');
      await expect(() => pgClient.head({ query })).rejects.toMatchObject({
        message: 'Request failed with status code 400',
        status: 400,
        statusText: 'Bad Request',
      });
    });
  });
});
