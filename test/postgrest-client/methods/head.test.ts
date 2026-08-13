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

describe('reqOptions', () => {
  describe.each([
    ['fetch', undefined],
    ['axios', axios.create()],
  ])('%s', (_name, axiosInstance) => {
    const pgClient = axiosInstance
      ? new PostgrestClient<DB, 'axios'>({ base: BASE_URL, axiosInstance })
      : new PostgrestClient<DB>({ base: BASE_URL });

    it('passes custom headers', async () => {
      const query = pgClient.query('actors').count('exact');
      const { totalLength } = await pgClient.head(
        { query },
        { headers: { 'X-Custom-Header': 'test' } },
      );
      expect(totalLength).toBeTypeOf('number');
    });

    it('aborted request throws', async () => {
      const controller = new AbortController();
      controller.abort();
      const query = pgClient.query('actors');
      await expect(
        pgClient.head({ query }, { signal: controller.signal }),
      ).rejects.toThrow();
    });
  });

  describe('fetch', () => {
    const pgClient = new PostgrestClient<DB>({ base: BASE_URL });

    it('rejects axios-specific options at compile time', () => {
      const query = pgClient.query('actors');
      // @ts-expect-error responseType is an Axios option, not a valid RequestInit property
      pgClient.head({ query }, { responseType: 'json' });
    });

    it('headers object', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch');
      const query = pgClient.query('actors');
      await pgClient.head({ query }, { headers: { 'my-header': 'value' } });
      const headers = new Headers(fetchSpy.mock.calls[0][1]!.headers);
      expect(Array.from(headers?.entries())).toContainEqual([
        'my-header',
        'value',
      ]);
    });

    it('headers instance', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch');
      const query = pgClient.query('actors');
      await pgClient.head(
        { query },
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
    const axiosSpy = vi.spyOn(Axios.prototype, 'head');
    const pgClient = new PostgrestClient<DB, 'axios'>({
      base: BASE_URL,
      axiosInstance: axios.create(),
    });

    afterEach(() => {
      axiosSpy.mockClear();
    });

    it('rejects fetch-specific options at compile time', () => {
      const query = pgClient.query('actors');
      pgClient.head(
        { query },
        // @ts-expect-error mode is a fetch RequestInit option, not valid for AxiosRequestConfig
        { mode: 'cors' },
      );
    });

    it('headers object', async () => {
      const query = pgClient.query('actors');
      await pgClient.head({ query }, { headers: { 'my-header': 'value' } });
      const headers = new Headers(
        axiosSpy.mock.calls[0][1]!.headers as Record<string, string>,
      );
      expect(Array.from(headers?.entries())).toContainEqual([
        'my-header',
        'value',
      ]);
    });

    it('headers instance', async () => {
      const query = pgClient.query('actors');
      await pgClient.head(
        { query },
        { headers: new AxiosHeaders({ 'my-header': 'value' }) },
      );
      const headers = new Headers(
        axiosSpy.mock.calls[0][1]!.headers as Record<string, string>,
      );
      expect(Array.from(headers?.entries())).toContainEqual([
        'my-header',
        'value',
      ]);
    });

    it('headers axios headers instance', async () => {
      const query = pgClient.query('actors');
      await pgClient.head(
        { query },
        { headers: new AxiosHeaders({ 'my-header': 'value' }) },
      );
      const headers = new Headers(
        axiosSpy.mock.calls[0][1]!.headers as Record<string, string>,
      );
      expect(Array.from(headers?.entries())).toContainEqual([
        'my-header',
        'value',
      ]);
    });
  });
});
