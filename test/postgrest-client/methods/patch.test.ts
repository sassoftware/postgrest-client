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

  it('simple object', async () => {
    const query = pgClient.query('competitions').eq('id', 1);
    const { status } = await pgClient.patch({
      query,
      data: { name: 'Academy Awards', year: 2023 },
    });
    assert<Equals<typeof status, number>>();
    expect(status).toBe(204);
  });

  it('simple array', async () => {
    const query = pgClient.query('competitions').eq('id', 1);
    const { status } = await pgClient.patch({
      query,
      data: { name: 'Academy Awards', year: 2023 },
    });
    assert<Equals<typeof status, number>>();
    expect(status).toBe(204);
  });

  it('return headers only', async () => {
    const query = pgClient
      .query('competitions')
      .eq('id', 1)
      .returning('headers-only');
    const { status } = await pgClient.patch({
      query,
      data: { name: 'Academy Awards', year: 2023 },
    });
    assert<Equals<typeof status, number>>();
    expect(status).toBe(204);
  });

  it('return representation (single)', async () => {
    const query = pgClient
      .query('competitions')
      .eq('id', 1)
      .returning('representation')
      .single();
    const data = { name: 'Academy Awards', year: 2023 };
    const { status, row } = await pgClient.patch({
      query,
      data,
    });
    assert<Equals<typeof status, number>>();
    assert<Equals<typeof row, { id: number; name: string; year: number }>>();
    expect(status).toBe(200);
    expect(row).toMatchObject(data);
  });

  it('return representation (array)', async () => {
    const query = pgClient
      .query('competitions')
      .eq('id', 1)
      .returning('representation');
    const data = { name: 'Academy Awards', year: 2023 };
    const { status, rows } = await pgClient.patch({
      query,
      data,
    });
    assert<Equals<typeof status, number>>();
    assert<Equals<typeof rows, { id: number; name: string; year: number }[]>>();
    expect(status).toBe(200);
    expect(rows).toMatchObject([data]);
  });

  it('select', async () => {
    const query = pgClient
      .query('competitions')
      .eq('id', 1)
      .returning('representation')
      .select('year');
    const data = { name: 'Academy Awards', year: 2023 };
    const { status, rows } = await pgClient.patch({
      query,
      data,
    });
    assert<Equals<typeof status, number>>();
    assert<Equals<typeof rows, { year: number }[]>>();
    expect(status).toBe(200);
    expect(rows).toMatchObject([{ year: 2023 }]);
  });

  describe('errors', () => {
    it('invalid table', async () => {
      // @ts-expect-error testing an error
      const query = pgClient.query('non-existing').eq('id', 1);
      await expect(() =>
        pgClient.patch({ query, data: {} }),
      ).rejects.toMatchObject({
        message: 'Request failed with status code 404',
        status: 404,
        statusText: 'Not Found',
      });
    });

    it('invalid column', async () => {
      const query = pgClient
        .query('actors')
        .eq('id', 1)
        // @ts-expect-error testing an error
        .select('invalid')
        .returning('representation');
      await expect(() =>
        pgClient.patch({ query, data: {} }),
      ).rejects.toMatchObject({
        status: 400,
        statusText: 'Bad Request',
      });
    });

    it('invalid payload', async () => {
      const query = pgClient.query('actors').eq('id', 1);
      await expect(() =>
        // @ts-expect-error testing an error
        pgClient.patch({ query, data: [{ invalid: 'invalid' }] }),
      ).rejects.toMatchObject({
        status: 400,
        statusText: 'Bad Request',
        data: {
          code: 'PGRST204',
          message: expect.any(String),
        },
      });
    });

    it('invalid payload (representation)', async () => {
      const query = pgClient
        .query('actors')
        .eq('id', 1)
        .returning('representation');
      await expect(() =>
        // @ts-expect-error testing an error
        pgClient.patch({ query, data: [{ invalid: 'invalid' }] }),
      ).rejects.toMatchObject({
        status: 400,
        statusText: 'Bad Request',
        data: {
          code: 'PGRST204',
          message: expect.any(String),
        },
      });
    });

    // NOTE: this one succeeds
    it('invalid column, but no representation', async () => {
      const query = pgClient
        .query('competitions')
        .eq('id', 1)
        // @ts-expect-error testing an error
        .select('invalid');
      const { status } = await pgClient.patch({
        query,
        data: { name: 'Academy Awards', year: 2023 },
      });
      assert<Equals<typeof status, number>>();
      expect(status).toBe(204);
    });
  });
});
