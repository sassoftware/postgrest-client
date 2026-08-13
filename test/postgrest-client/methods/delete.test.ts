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

describe('reqOptions', () => {
  const NON_EXISTING_ID = 999999999;

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
        .eq('id', NON_EXISTING_ID)
        .count('exact');
      const { totalLength } = await pgClient.delete(
        { query },
        { headers: { 'X-Custom-Header': 'test' } },
      );
      expect(totalLength).toBeTypeOf('number');
    });

    it('aborted request throws', async () => {
      const controller = new AbortController();
      controller.abort();
      const query = pgClient.query('competitions').eq('id', NON_EXISTING_ID);
      await expect(
        pgClient.delete({ query }, { signal: controller.signal }),
      ).rejects.toThrow();
    });
  });

  describe('fetch', () => {
    const pgClient = new PostgrestClient<DB>({ base: BASE_URL });

    it('rejects axios-specific options at compile time', () => {
      const query = pgClient.query('competitions').eq('id', NON_EXISTING_ID);
      // @ts-expect-error responseType is an Axios option, not a valid RequestInit property
      pgClient.delete({ query }, { responseType: 'json' });
    });

    it('headers object', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch');
      const query = pgClient.query('competitions').eq('id', NON_EXISTING_ID);
      await pgClient.delete({ query }, { headers: { 'my-header': 'value' } });
      const headers = new Headers(fetchSpy.mock.calls[0][1]!.headers);
      expect(Array.from(headers?.entries())).toContainEqual([
        'my-header',
        'value',
      ]);
    });

    it('headers instance', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch');
      const query = pgClient.query('competitions').eq('id', NON_EXISTING_ID);
      await pgClient.delete(
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
    const axiosSpy = vi.spyOn(Axios.prototype, 'delete');
    const pgClient = new PostgrestClient<DB, 'axios'>({
      base: BASE_URL,
      axiosInstance: axios.create(),
    });

    afterEach(() => {
      axiosSpy.mockClear();
    });

    it('rejects fetch-specific options at compile time', () => {
      const query = pgClient.query('competitions').eq('id', NON_EXISTING_ID);
      pgClient.delete(
        { query },
        // @ts-expect-error mode is a fetch RequestInit option, not valid for AxiosRequestConfig
        { mode: 'cors' },
      );
    });

    it('headers object', async () => {
      const query = pgClient.query('competitions').eq('id', NON_EXISTING_ID);
      await pgClient.delete({ query }, { headers: { 'my-header': 'value' } });
      const headers = new Headers(
        axiosSpy.mock.calls[0][1]!.headers as Record<string, string>,
      );
      expect(Array.from(headers?.entries())).toContainEqual([
        'my-header',
        'value',
      ]);
    });

    it('headers instance', async () => {
      const query = pgClient.query('competitions').eq('id', NON_EXISTING_ID);
      await pgClient.delete(
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
      const query = pgClient.query('competitions').eq('id', NON_EXISTING_ID);
      await pgClient.delete(
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
