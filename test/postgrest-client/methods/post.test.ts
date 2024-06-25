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
    const query = pgClient.query('competitions');
    const { status } = await pgClient.post({
      query,
      data: { name: 'Academy Awards', year: 2023 },
    });
    assert<Equals<typeof status, number>>();
    expect(status).toBe(201);
  });

  it('simple array', async () => {
    const query = pgClient.query('competitions');
    const { status } = await pgClient.post({
      query,
      data: [{ name: 'Academy Awards', year: 2023 }],
    });
    assert<Equals<typeof status, number>>();
    expect(status).toBe(201);
  });

  it('return headers only', async () => {
    const query = pgClient.query('competitions').returning('headers-only');
    const { status, location } = await pgClient.post({
      query,
      data: { name: 'Academy Awards', year: 2023 },
    });
    assert<Equals<typeof location, string>>();
    assert<Equals<typeof status, number>>();
    expect(status).toBe(201);
    expect(location).not.toBeUndefined();
  });

  it('return representation (single)', async () => {
    const query = pgClient
      .query('competitions')
      .returning('representation')
      .single();
    const data = { name: 'Academy Awards', year: 2023 };
    const { status, row } = await pgClient.post({
      query,
      data,
    });
    assert<Equals<typeof status, number>>();
    assert<Equals<typeof row, { id: number; name: string; year: number }>>();
    expect(status).toBe(201);
    expect(row).toMatchObject(data);
  });

  it('return representation (array)', async () => {
    const query = pgClient.query('competitions').returning('representation');
    const data = { name: 'Academy Awards', year: 2023 };
    const { status, rows } = await pgClient.post({
      query,
      data,
    });
    assert<Equals<typeof status, number>>();
    assert<Equals<typeof rows, { id: number; name: string; year: number }[]>>();
    expect(status).toBe(201);
    expect(rows).toMatchObject([data]);
  });

  it('select', async () => {
    const query = pgClient
      .query('competitions')
      .returning('representation')
      .select('year');
    const data = { name: 'Academy Awards', year: 2023 };
    const { status, rows } = await pgClient.post({
      query,
      data,
    });
    assert<Equals<typeof status, number>>();
    assert<Equals<typeof rows, { year: number }[]>>();
    expect(status).toBe(201);
    expect(rows).toMatchObject([{ year: 2023 }]);
  });

  it('number of inserted', async () => {
    const query = pgClient.query('competitions').count('exact');
    const data = [
      { name: 'Academy Awards', year: 2023 },
      { name: 'Academy Awards', year: 2022 },
      { name: 'Academy Awards', year: 2021 },
    ];
    const { status } = await pgClient.post({ query, data });
    assert<Equals<typeof status, number>>();
    expect(status).toBe(201);
  });

  it('number of inserted, and representation', async () => {
    const query = pgClient
      .query('competitions')
      .count('exact')
      .returning('representation')
      .select(['name', 'year']);
    const data = [
      { name: 'Academy Awards', year: 2023 },
      { name: 'Academy Awards', year: 2022 },
      { name: 'Academy Awards', year: 2021 },
    ];
    const { status, rows } = await pgClient.post({ query, data });
    assert<Equals<typeof status, number>>();
    assert<Equals<typeof data, typeof rows>>();
    expect(status).toBe(201);
  });

  describe('errors', () => {
    it('invalid table', async () => {
      // @ts-expect-error testing an error
      const query = pgClient.query('non-existing');
      await expect(() =>
        pgClient.post({ query, data: [] }),
      ).rejects.toMatchObject({
        message: 'Request failed with status code 404',
        status: 404,
        statusText: 'Not Found',
      });
    });

    it('invalid column', async () => {
      const query = pgClient
        .query('actors')
        // @ts-expect-error testing an error
        .select('invalid')
        .returning('representation');
      await expect(() =>
        pgClient.post({ query, data: [] }),
      ).rejects.toMatchObject({
        message: 'Request failed with status code 400',
        status: 400,
        statusText: 'Bad Request',
      });
    });

    it('invalid payload', async () => {
      const query = pgClient.query('actors');
      await expect(() =>
        // @ts-expect-error testing an error
        pgClient.post({ query, data: [{ invalid: 'invalid' }] }),
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
      const query = pgClient.query('actors').returning('representation');
      await expect(() =>
        // @ts-expect-error testing an error
        pgClient.post({ query, data: [{ invalid: 'invalid' }] }),
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
      // @ts-expect-error testing an error
      const query = pgClient.query('competitions').select('invalid');
      const { status } = await pgClient.post({
        query,
        data: [{ name: 'Academy Awards', year: 2023 }],
      });
      assert<Equals<typeof status, number>>();
      expect(status).toBe(201);
    });
  });

  describe('onConflict', () => {
    const payload = [
      {
        film_id: 2,
        runtime: '02:55',
        camera: 'Arriflex 35-III',
        sound: 'stereo',
      },
    ];
    const conflictErrorRes = {
      message: 'Request failed with status code 409',
      status: 409,
      statusText: 'Conflict',
      data: {
        code: '23505',
        details: 'Key (film_id)=(2) already exists.',
        hint: null,
        message:
          'duplicate key value violates unique constraint "technical_specs_film_id_key"',
      },
    };

    it('no header (error)', async () => {
      const query = pgClient.query('technical_specs');
      await expect(() =>
        pgClient.post({ query, data: payload }),
      ).rejects.toMatchObject(conflictErrorRes);
    });

    it('ignore duplicates (header only - no "on_conflict")', async () => {
      const query = pgClient.query('technical_specs');
      await expect(() =>
        pgClient.post({ query, data: payload }),
      ).rejects.toMatchObject(conflictErrorRes);
    });

    it('ignore duplicates', async () => {
      const query = pgClient
        .query('technical_specs')
        .onConflict('ignore-duplicates', 'film_id');
      const { status } = await pgClient.post({ query, data: payload });
      assert<Equals<typeof status, number>>();
      expect(status).toBe(201);
    });
  });

  it('JSON columns', async () => {
    const query = pgClient.query('people').returning('representation').single();
    const data = { json_data: { age: 30 } };
    const { status, row } = await pgClient.post({
      query,
      data,
    });
    assert<Equals<typeof status, number>>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    assert<Equals<typeof row, { id: number; json_data: any }>>();
    expect(status).toBe(201);
    expect(row).toMatchObject(data);
  });

  it('composite columns', async () => {
    const query = pgClient
      .query('countries')
      .returning('representation')
      .single();
    const data = {
      languages: ['en', 'fr'],
      location: { lat: 2.45, lng: 1 },
    };
    const { status, row } = await pgClient.post({
      query,
      data,
    });
    assert<Equals<typeof status, number>>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    assert<
      Equals<
        typeof row,
        {
          id: number;
          languages: string[];
          location: { lat: number; lng: number };
        }
      >
    >();
    expect(status).toBe(201);
    expect(row).toMatchObject(data);
  });

  describe('columns and missing', () => {
    it('bulk insert', async () => {
      const { status, rows } = await pgClient.post({
        query: pgClient
          .query('foo')
          .columns(['bar', 'baz'])
          .missing('default')
          .returning('representation'),
        data: [{}, { bar: 'test' }, { baz: 20 }],
      });
      expect(status).toBe(201);
      expect(rows).toEqual([
        expect.objectContaining({ bar: 'bar', baz: 100 }),
        expect.objectContaining({ bar: 'test', baz: 100 }),
        expect.objectContaining({ bar: 'bar', baz: 20 }),
      ]);
    });

    it('bulk insert without columns', async () => {
      await expect(() =>
        pgClient.post({
          query: pgClient.query('foo').missing('default'),
          data: [{}, { bar: 'test' }, { baz: 20 }],
        }),
      ).rejects.toMatchObject({
        message: 'Request failed with status code 400',
        status: 400,
        statusText: 'Bad Request',
        data: {
          code: 'PGRST102',
          message: 'All object keys must match',
        },
      });
    });
  });
});
