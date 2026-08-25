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

describe('request options (reqOptions)', () => {
  const data = { id: 1, name: 'Cannes Film Festival', year: 2023 };

  describe.each([
    ['fetch', undefined],
    ['axios', axios.create()],
  ])('%s', (_name, axiosInstance) => {
    const pgClient = axiosInstance
      ? new PostgrestClient<DB, 'axios'>({ base: BASE_URL, axiosInstance })
      : new PostgrestClient<DB>({ base: BASE_URL });

    it('passes custom headers', async () => {
      const query = pgClient
        .query('competitions')
        .eq('id', 1)
        .returning('representation');
      const { rows } = await pgClient.put(
        { query, data },
        { headers: { 'X-Custom-Header': 'test' } },
      );
      expect(rows).toHaveLength(1);
    });

    it('aborted request throws', async () => {
      const controller = new AbortController();
      controller.abort();
      const query = pgClient.query('competitions').eq('id', 1);
      await expect(
        pgClient.put({ query, data }, { signal: controller.signal }),
      ).rejects.toThrow();
    });
  });

  describe('fetch', () => {
    const pgClient = new PostgrestClient<DB>({ base: BASE_URL });

    it('rejects axios-specific options at compile time', () => {
      const query = pgClient.query('competitions').eq('id', 1);
      pgClient.put(
        { query, data },
        // @ts-expect-error responseType is an Axios option, not a valid RequestInit property
        { responseType: 'json' },
      );
    });

    it('headers object', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch');
      const query = pgClient.query('competitions').eq('id', 1);
      await pgClient.put(
        { query, data },
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
      await pgClient.put(
        { query, data },
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
    const axiosSpy = vi.spyOn(Axios.prototype, 'put');
    const pgClient = new PostgrestClient<DB, 'axios'>({
      base: BASE_URL,
      axiosInstance: axios.create(),
    });

    afterEach(() => {
      axiosSpy.mockClear();
    });

    it('rejects fetch-specific options at compile time', () => {
      const query = pgClient.query('competitions').eq('id', 1);
      pgClient.put(
        { query, data },
        // @ts-expect-error mode is a fetch RequestInit option, not valid for AxiosRequestConfig
        { mode: 'cors' },
      );
    });

    it('headers object', async () => {
      const query = pgClient.query('competitions').eq('id', 1);
      await pgClient.put(
        { query, data },
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
      await pgClient.put(
        { query, data },
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
      await pgClient.put(
        { query, data },
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
