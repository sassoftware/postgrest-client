import axios, { Axios, AxiosHeaders } from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Equals, assert } from 'tsafe';

import { PostgrestClient } from '../../../src/postgrest-client';
import { BASE_URL } from '../constants';
import DB from '../test-db';

describe.each([
  ['fetch', undefined],
  ['axios', axios.create()],
])('%s', (_name, axiosInstance) => {
  const pgClient = axiosInstance
    ? new PostgrestClient<DB, 'axios'>({ base: BASE_URL, axiosInstance })
    : new PostgrestClient<DB>({ base: BASE_URL });

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

describe('reqOptions', () => {
  describe.each([
    ['fetch', undefined],
    ['axios', axios.create()],
  ])('%s', (_name, axiosInstance) => {
    const pgClient = axiosInstance
      ? new PostgrestClient<DB, 'axios'>({ base: BASE_URL, axiosInstance })
      : new PostgrestClient<DB>({ base: BASE_URL });

    it('passes custom headers', async () => {
      const query = pgClient.query('competitions').eq('id', 1).count('exact');
      const { totalLength } = await pgClient.patch(
        { query, data: { name: 'Academy Awards' } },
        { headers: { 'X-Custom-Header': 'test' } },
      );
      expect(totalLength).toBeTypeOf('number');
    });

    it('aborted request throws', async () => {
      const controller = new AbortController();
      controller.abort();
      const query = pgClient.query('competitions').eq('id', 1);
      await expect(
        pgClient.patch(
          { query, data: { name: 'Academy Awards' } },
          { signal: controller.signal },
        ),
      ).rejects.toThrow();
    });
  });

  describe('fetch', () => {
    const pgClient = new PostgrestClient<DB>({ base: BASE_URL });

    it('rejects axios-specific options at compile time', () => {
      const query = pgClient.query('competitions').eq('id', 1);
      pgClient.patch(
        { query, data: { name: 'Academy Awards' } },
        // @ts-expect-error responseType is an Axios option, not a valid RequestInit property
        { responseType: 'json' },
      );
    });

    it('headers object', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch');
      const query = pgClient.query('competitions').eq('id', 1);
      await pgClient.patch(
        { query, data: { name: 'Academy Awards' } },
        { headers: { 'my-header': 'value' } },
      );
      const headers = new Headers(fetchSpy.mock.calls[0][1]!.headers);
      expect(Array.from(headers?.entries())).toContainEqual([
        'my-header',
        'value',
      ]);
    });

    it('headers instance', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch');
      const query = pgClient.query('competitions').eq('id', 1);
      await pgClient.patch(
        { query, data: { name: 'Academy Awards' } },
        { headers: new Headers({ 'my-header': 'value' }) },
      );
      const headers = new Headers(fetchSpy.mock.calls[0][1]!.headers);
      expect(Array.from(headers?.entries())).toContainEqual([
        'my-header',
        'value',
      ]);
    });
  });

  describe('axios', () => {
    const axiosSpy = vi.spyOn(Axios.prototype, 'patch');
    const pgClient = new PostgrestClient<DB, 'axios'>({
      base: BASE_URL,
      axiosInstance: axios.create(),
    });

    afterEach(() => {
      axiosSpy.mockClear();
    });

    it('rejects fetch-specific options at compile time', () => {
      const query = pgClient.query('competitions').eq('id', 1);
      pgClient.patch(
        { query, data: { name: 'Academy Awards' } },
        // @ts-expect-error mode is a fetch RequestInit option, not valid for AxiosRequestConfig
        { mode: 'cors' },
      );
    });

    it('headers object', async () => {
      const query = pgClient.query('competitions').eq('id', 1);
      await pgClient.patch(
        { query, data: { name: 'Academy Awards' } },
        { headers: { 'my-header': 'value' } },
      );
      const headers = new Headers(
        axiosSpy.mock.calls[0][2]!.headers as Record<string, string>,
      );
      expect(Array.from(headers?.entries())).toContainEqual([
        'my-header',
        'value',
      ]);
    });

    it('headers instance', async () => {
      const query = pgClient.query('competitions').eq('id', 1);
      await pgClient.patch(
        { query, data: { name: 'Academy Awards' } },
        { headers: new AxiosHeaders({ 'my-header': 'value' }) },
      );
      const headers = new Headers(
        axiosSpy.mock.calls[0][2]!.headers as Record<string, string>,
      );
      expect(Array.from(headers?.entries())).toContainEqual([
        'my-header',
        'value',
      ]);
    });

    it('headers axios headers instance', async () => {
      const query = pgClient.query('competitions').eq('id', 1);
      await pgClient.patch(
        { query, data: { name: 'Academy Awards' } },
        { headers: new AxiosHeaders({ 'my-header': 'value' }) },
      );
      const headers = new Headers(
        axiosSpy.mock.calls[0][2]!.headers as Record<string, string>,
      );
      expect(Array.from(headers?.entries())).toContainEqual([
        'my-header',
        'value',
      ]);
    });
  });
});
