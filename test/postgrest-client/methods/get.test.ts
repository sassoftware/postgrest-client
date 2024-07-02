import axios from 'axios';
import { describe, expect, it } from 'vitest';
import { Equals, assert } from 'tsafe';

import {
  PostgrestClient,
  QueryResponseGet,
} from '../../../src/postgrest-client';
import { BASE_URL } from '../constants';
import DB from '../test-db';

describe.each([
  ['fetch', undefined],
  ['axios', axios.create()],
])('%s', (_name, axiosInstance) => {
  const pgClient = new PostgrestClient<DB>({ base: BASE_URL, axiosInstance });

  it('simple eq (array)', async () => {
    const query = pgClient.query('actors').eq('id', 1);
    const { rows, status } = await pgClient.get({ query });

    assert<Equals<typeof status, number>>();
    assert<
      Equals<
        typeof rows,
        { id: number; first_name: string; last_name: string }[]
      >
    >();
    expect(status).toBe(200);
    expect(rows).toHaveLength(1);
    expect(rows).toEqual([
      {
        id: 1,
        first_name: 'Marlon',
        last_name: 'Brando',
      },
    ]);
  });

  it('simple eq (single object)', async () => {
    const query = pgClient.query('actors').eq('id', 1).single();
    const { row, status } = await pgClient.get({ query });

    assert<Equals<typeof status, number>>();
    assert<
      Equals<typeof row, { id: number; first_name: string; last_name: string }>
    >();
    expect(status).toBe(200);
    expect(row).toEqual({
      id: 1,
      first_name: 'Marlon',
      last_name: 'Brando',
    });
  });

  it('simple eq with select (single object)', async () => {
    const query = pgClient
      .query('actors')
      .eq('id', 1)
      .select(['first_name', 'last_name'])
      .single();
    const { row, status } = await pgClient.get({ query });

    assert<Equals<typeof status, number>>();
    assert<Equals<typeof row, { first_name: string; last_name: string }>>();
    expect(status).toBe(200);
    expect(row).toEqual({
      first_name: 'Marlon',
      last_name: 'Brando',
    });
  });

  it('simple logical', async () => {
    const query = pgClient
      .query('actors')
      .or((q) => [q.eq('id', 1), q.eq('id', 3)]);
    const { rows, status } = await pgClient.get({ query });

    assert<Equals<typeof status, number>>();
    assert<
      Equals<
        typeof rows,
        { id: number; first_name: string; last_name: string }[]
      >
    >();
    expect(status).toBe(200);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.id)).toEqual([1, 3]);
  });

  it('custom headers', async () => {
    const query = pgClient.query('actors');
    const headers = new Headers({ Prefer: 'count=exact' });
    // @ts-expect-error expected wrong type
    const { totalLength } = await pgClient.get({ query, headers });
    expect(totalLength).toBeTypeOf('number');
  });

  describe('count', () => {
    it('exact', async () => {
      const query = pgClient.query('actors').count('exact');
      const { rows, pagesLength, totalLength, status } = await pgClient.get({
        query,
      });

      assert<Equals<typeof status, number>>();
      assert<
        Equals<
          typeof rows,
          { id: number; first_name: string; last_name: string }[]
        >
      >();
      expect(status).toBe(200);
      expect(rows).toHaveLength(3);
      expect(pagesLength).toBe(1);
      expect(totalLength).toBe(3);
    });

    it('planned', async () => {
      const query = pgClient.query('actors').count('planned');
      const { rows, totalLength, pagesLength, status } = await pgClient.get({
        query,
      });

      assert<Equals<typeof status, number>>();
      assert<
        Equals<
          typeof rows,
          { id: number; first_name: string; last_name: string }[]
        >
      >();
      expect(rows).toHaveLength(3);
      expect(pagesLength).toBe(1);
      expect(totalLength).toBeGreaterThanOrEqual(3);
    });

    it('estimated', async () => {
      const query = pgClient.query('actors').count('estimated');
      const { rows, pagesLength, totalLength, status } = await pgClient.get({
        query,
      });

      // NOTE: status value depends on PGRST_DB_MAX_ROWS config.
      // It will be 206 in case PGRST_DB_MAX_ROWS is set to ∞ (default)
      assert<Equals<typeof status, number>>();
      assert<
        Equals<
          typeof rows,
          { id: number; first_name: string; last_name: string }[]
        >
      >();
      expect(status).toBe(200);
      expect(rows).toHaveLength(3);
      expect(pagesLength).toBe(1);
      expect(totalLength).toBe(3);
    });

    it('count then other filters', async () => {
      const query = pgClient
        .query('actors')
        .count('exact')
        .order([{ column: 'id' }])
        .eq('id', 1);
      const { rows, pagesLength, totalLength, status } = await pgClient.get({
        query,
      });

      assert<Equals<typeof status, number>>();
      assert<
        Equals<
          typeof rows,
          { id: number; first_name: string; last_name: string }[]
        >
      >();
      expect(status).toBe(200);
      expect(rows).toHaveLength(1);
      expect(pagesLength).toBe(1);
      expect(totalLength).toBe(1);
    });

    describe('empty table', () => {
      it('no limit', async () => {
        const query = pgClient.query('empty').count('exact');
        const { rows, pagesLength, totalLength, status } = await pgClient.get({
          query,
        });
        expect(status).toBe(200);
        expect(rows).toHaveLength(0);
        expect(pagesLength).toBe(1);
        expect(totalLength).toBe(0);
      });

      it('limit 10', async () => {
        const query = pgClient.query('empty').count('exact').limit(10);
        const { rows, pagesLength, totalLength, status } = await pgClient.get({
          query,
        });
        expect(status).toBe(200);
        expect(rows).toHaveLength(0);
        expect(pagesLength).toBe(1);
        expect(totalLength).toBe(0);
      });
    });

    describe('pagination', async () => {
      it('last page (10)', async () => {
        const query = pgClient.query('actors').count('exact').limit(10);
        const { rows, pagesLength, totalLength, status } = await pgClient.get({
          query,
        });

        assert<Equals<typeof status, number>>();
        assert<
          Equals<
            typeof rows,
            { id: number; first_name: string; last_name: string }[]
          >
        >();
        expect(status).toBe(200);
        expect(rows).toHaveLength(3);
        expect(pagesLength).toBe(1);
        expect(totalLength).toBe(3);
      });

      it('last page (2)', async () => {
        const query = pgClient.query('actors').count('exact').page(1, 2);
        const { rows, pagesLength, totalLength, status } = await pgClient.get({
          query,
        });

        assert<Equals<typeof status, number>>();
        assert<
          Equals<
            typeof rows,
            { id: number; first_name: string; last_name: string }[]
          >
        >();
        expect(status).toBe(206);
        expect(rows).toHaveLength(1);
        expect(pagesLength).toBe(2);
        expect(totalLength).toBe(3);
      });
    });
  });

  describe('errors', () => {
    it('invalid table', async () => {
      // @ts-expect-error testing an error
      const query = pgClient.query('non-existing');
      await expect(() => pgClient.get({ query })).rejects.toMatchObject({
        message: 'Request failed with status code 404',
        status: 404,
        statusText: 'Not Found',
        data: {
          code: '42P01',
          message: 'relation "api.non-existing" does not exist',
        },
      });
    });

    it('invalid column', async () => {
      // @ts-expect-error testing an error
      const query = pgClient.query('actors').select('invalid');
      await expect(() => pgClient.get({ query })).rejects.toMatchObject({
        message: 'Request failed with status code 400',
        status: 400,
        statusText: 'Bad Request',
        data: {
          code: '42703',
          message: 'column actors.invalid does not exist',
        },
      });
    });
  });

  describe('embedding', () => {
    it('select all', async () => {
      const { rows } = await pgClient.get({
        query: pgClient
          .query('films')
          .select('*')
          .select(
            pgClient.embeddedQuery('directors', 'one', 'not null').select('*'),
          ),
      });
      assert<
        Equals<
          typeof rows,
          {
            id: number;
            director_id: number;
            title: string;
            year: number;
            rating: number;
            language: string;
            directors: {
              id: number;
              first_name: string;
              last_name: string;
            };
          }[]
        >
      >();
      expect(rows).toBeInstanceOf(Array);
      expect(rows[0].directors).not.toBeInstanceOf(Array);
      expect(rows[0].directors.first_name).toBeTypeOf('string');
    });

    it('chaining select', async () => {
      const { rows } = await pgClient.get({
        query: pgClient
          .query('films')
          .select('title')
          .select('year')
          .select(
            pgClient
              .embeddedQuery('directors', 'one', 'not null')
              .select('last_name')
              .select('first_name'),
          ),
      });
      assert<
        Equals<
          typeof rows,
          {
            title: string;
            year: number;
            directors: {
              last_name: string;
              first_name: string;
            };
          }[]
        >
      >();
      expect(rows).toBeInstanceOf(Array);
      expect(rows[0].directors).not.toBeInstanceOf(Array);
      expect(rows[0].directors.first_name).toBeTypeOf('string');
    });

    it('array select', async () => {
      const { rows } = await pgClient.get({
        query: pgClient
          .query('films')
          .select(['title', 'year'])
          .select(
            pgClient
              .embeddedQuery('directors', 'one', 'not null')
              .select(['last_name', 'first_name']),
          ),
      });
      assert<
        Equals<
          typeof rows,
          {
            title: string;
            year: number;
            directors: {
              last_name: string;
              first_name: string;
            };
          }[]
        >
      >();
      expect(rows[0]).toEqual({
        title: expect.any(String),
        year: expect.any(Number),
        directors: {
          first_name: expect.any(String),
          last_name: expect.any(String),
        },
      });
    });

    it('array response', async () => {
      const { rows } = await pgClient.get({
        query: pgClient
          .query('directors')
          .select(['first_name', 'last_name'])
          .select(pgClient.embeddedQuery('films', 'many').select('title')),
      });
      assert<
        Equals<
          typeof rows,
          {
            last_name: string;
            first_name: string;
            films: { title: string }[];
          }[]
        >
      >();
      expect(rows[0]).toEqual({
        first_name: expect.any(String),
        last_name: expect.any(String),
        films: [{ title: expect.any(String) }],
      });
    });

    it('single with embedded', async () => {
      const { row } = await pgClient.get({
        query: pgClient
          .query('films')
          .eq('id', 1)
          .single()
          .select('*')
          .select(
            pgClient.embeddedQuery('directors', 'one', 'not null').select('*'),
          ),
      });
      expect(row.directors).not.toBeInstanceOf(Array);
      expect(row.directors.first_name).toBeTypeOf('string');
    });

    // NOTE: throws an error if we are expecting an array for embedded document
    // but PostgREST responds with a single object, and vice versa
    it('incorrect cardinality', async () => {
      const singleObjectRes = pgClient
        .query('films')
        .select(pgClient.embeddedQuery('directors', 'many').select('*'));
      await expect(() =>
        pgClient.get({ query: singleObjectRes }),
      ).rejects.toThrowError('Incorrect cardinality "many" for embedded query');

      const arrayRes = pgClient
        .query('directors')
        .select(pgClient.embeddedQuery('films', 'one').select('*'));
      await expect(() =>
        pgClient.get({ query: arrayRes }),
      ).rejects.toThrowError('Incorrect cardinality "one" for embedded query');
    });

    it('empty response with embedded', async () => {
      const query = pgClient
        .query('films')
        // NOTE: invalid ID to force empty response
        .eq('id', -1)
        .select(pgClient.embeddedQuery('directors', 'one').select('*'));
      await expect(pgClient.get({ query })).resolves.toMatchObject({
        rows: [],
      });
    });

    it('rename', async () => {
      const { rows } = await pgClient.get({
        query: pgClient
          .query('films')
          .select('*')
          .select([
            pgClient.embeddedQuery('directors', 'one', 'not null').select('*'),
            { name: 'd' },
          ]),
      });
      expect(rows).toBeInstanceOf(Array);
      expect(rows[0].d).not.toBeInstanceOf(Array);
      expect(rows[0].d.first_name).toBeTypeOf('string');
    });

    it('single rename', async () => {
      const { row } = await pgClient.get({
        query: pgClient
          .query('films')
          .eq('id', 1)
          .single()
          .select('*')
          .select([
            pgClient.embeddedQuery('directors', 'one', 'not null').select('*'),
            { name: 'd' },
          ]),
      });
      expect(row.d).not.toBeInstanceOf(Array);
      expect(row.d.first_name).toBeTypeOf('string');
    });

    it('rename one to many', async () => {
      const { rows } = await pgClient.get({
        query: pgClient
          .query('directors')
          .select('*')
          .select([
            pgClient.embeddedQuery('films', 'many').select('*'),
            { name: 'f' },
          ]),
      });
      expect(rows).toBeInstanceOf(Array);
      expect(rows[0].f).toBeInstanceOf(Array);
      expect(rows[0].f[0].title).toBeTypeOf('string');
    });

    it('single rename one to many', async () => {
      const { row } = await pgClient.get({
        query: pgClient
          .query('directors')
          .eq('id', 1)
          .single()
          .select('*')
          .select([
            pgClient.embeddedQuery('films', 'many').select('*'),
            { name: 'f' },
          ]),
      });
      expect(row.f).toBeInstanceOf(Array);
      expect(row.f[0].title).toBeTypeOf('string');
    });

    it('invalid modifier', async () => {
      await expect(() =>
        pgClient.get({
          query: pgClient
            .query('films')
            .select('*')
            .select([
              pgClient.embeddedQuery('directors', 'one').select('*'),
              // @ts-expect-error testing missing name
              {},
            ]),
        }),
      ).rejects.toThrowError('Invalid select {}');
    });

    it('nullable embedded', () => {
      const query = pgClient
        .query('films')
        .select(pgClient.embeddedQuery('directors', 'one').select('*'))
        .single();
      type Response = QueryResponseGet<typeof query>['row'];
      assert<
        Equals<
          Response,
          {
            directors: {
              id: number;
              first_name: string;
              last_name: string;
            } | null;
          }
        >
      >();
      // NOTE: there's no way to fail the test if the type assertion is incorrect
      // so this test will always succeed in runtime, but it might fail static analysis
    });

    describe('top level filtering (!inner)', () => {
      it('compared to non inner', async () => {
        const nonInner = await pgClient.get({
          query: pgClient
            .query('films')
            .select([
              pgClient
                .embeddedQuery('directors', 'one')
                .eq('last_name', 'Coppola'),
            ]),
        });

        expect(nonInner.rows).toHaveLength(4);

        const inner = await pgClient.get({
          query: pgClient
            .query('films')
            .select([
              pgClient
                .embeddedQuery('directors', 'one')
                .eq('last_name', 'Coppola')
                .inner(),
            ]),
        });

        expect(inner.rows).toHaveLength(2);
      });

      it('with rename', async () => {
        const { rows } = await pgClient.get({
          query: pgClient
            .query('films')
            .select('title')
            .select([
              pgClient
                .embeddedQuery('directors', 'one')
                .select('*')
                .eq('last_name', 'Coppola')
                .inner(),
              // singular instead of plural ("directors")
              { name: 'director' },
            ]),
        });

        expect(rows).toHaveLength(2);
        const expectedDirector = {
          id: expect.any(Number),
          first_name: 'Francis',
          last_name: 'Coppola',
        };
        expect(rows).toEqual([
          { title: 'The Godfather', director: expectedDirector },
          { title: 'The Godfather Part II', director: expectedDirector },
        ]);
      });
    });

    describe('top level ordering', () => {
      it('simple', async () => {
        const { rows } = await pgClient.get({
          query: pgClient
            .query('films')
            .select('title')
            .select(pgClient.embeddedQuery('directors', 'one').select('*'))
            .order([{ column: 'directors.last_name' }]),
        });
        expect(rows).toEqual([
          { title: 'The Godfather', directors: expect.any(Object) },
          { title: 'The Godfather Part II', directors: expect.any(Object) },
          {
            title: 'The Shawshank Redemption',
            directors: expect.any(Object),
          },
          { title: 'The Dark Knight', directors: expect.any(Object) },
        ]);
      });

      it('simple desc', async () => {
        const { rows } = await pgClient.get({
          query: pgClient
            .query('films')
            .select('title')
            .select(pgClient.embeddedQuery('directors', 'one').select('*'))
            .order([{ column: 'directors.last_name', order: 'desc' }]),
        });
        expect(rows).toEqual([
          { title: 'The Dark Knight', directors: expect.any(Object) },
          {
            title: 'The Shawshank Redemption',
            directors: expect.any(Object),
          },
          { title: 'The Godfather', directors: expect.any(Object) },
          { title: 'The Godfather Part II', directors: expect.any(Object) },
        ]);
      });

      it('secondary', async () => {
        const { rows } = await pgClient.get({
          query: pgClient
            .query('films')
            .select('title')
            .select(pgClient.embeddedQuery('directors', 'one').select('*'))
            .order([
              { column: 'directors.last_name' },
              { column: 'year', order: 'desc' },
            ]),
        });
        expect(rows).toEqual([
          { title: 'The Godfather Part II', directors: expect.any(Object) },
          { title: 'The Godfather', directors: expect.any(Object) },
          {
            title: 'The Shawshank Redemption',
            directors: expect.any(Object),
          },
          { title: 'The Dark Knight', directors: expect.any(Object) },
        ]);
      });

      it('with rename', async () => {
        const { rows } = await pgClient.get({
          query: pgClient
            .query('films')
            .select('title')
            .select([
              pgClient.embeddedQuery('directors', 'one').select('*'),
              { name: 'director' },
            ])
            .order([{ column: 'director.last_name' }]),
        });
        expect(rows).toEqual([
          { title: 'The Godfather', director: expect.any(Object) },
          { title: 'The Godfather Part II', director: expect.any(Object) },
          {
            title: 'The Shawshank Redemption',
            director: expect.any(Object),
          },
          { title: 'The Dark Knight', director: expect.any(Object) },
        ]);
      });
    });
  });

  describe('JSON columns', () => {
    it('simple typed', async () => {
      const { row } = await pgClient.get({
        query: pgClient
          .query('people')
          .eq('id', 1)
          .selectJson<{
            blood_type: string;
            country_code: number;
          }>(['json_data->blood_type', 'json_data->phones->0->country_code'])
          .single(),
      });
      assert<Equals<typeof row.blood_type, string>>();
      assert<Equals<typeof row.country_code, number>>();
      expect(row.blood_type).toBeTypeOf('string');
      expect(row.country_code).toBeTypeOf('number');
    });

    it('simple strings (no generic types)', async () => {
      const { row } = await pgClient.get({
        query: pgClient
          .query('people')
          .eq('id', 1)
          .select([
            'json_data->>blood_type',
            'json_data->phones->0->>country_code',
          ])
          .single(),
      });
      assert<Equals<typeof row.blood_type, string>>();
      assert<Equals<typeof row.country_code, string>>();
      expect(row.blood_type).toBeTypeOf('string');
      expect(row.country_code).toBeTypeOf('string');
    });

    it('horizontal filtering', async () => {
      const { row } = await pgClient.get({
        query: pgClient.query('people').eq('json_data->age', 18).single(),
      });
      expect(row.json_data).toMatchObject({
        blood_type: 'A-',
        age: 18,
        phones: [{ country_code: 61, number: '917-929-5745' }],
      });
    });

    it('order', async () => {
      const { rows } = await pgClient.get({
        query: pgClient
          .query('countries')
          .selectJson<{ lat: number }>(['location->lat', { name: 'lat' }])
          .order([{ column: 'location->lat', order: 'desc' }]),
      });
      const ordered = [...rows].sort((a, b) => b.lat - a.lat);
      expect(ordered).toEqual(rows);
    });
  });

  describe('composite columns', () => {
    it('composite fields', async () => {
      const { row } = await pgClient.get({
        query: pgClient.query('countries').eq('id', 1).single(),
      });
      expect(row).toMatchObject({
        id: 1,
        location: { lat: 1.1, lng: 2.2 },
        languages: ['en'],
      });
    });

    it('vertical filtering', async () => {
      const { row } = await pgClient.get({
        query: pgClient
          .query('countries')
          .eq('id', 1)
          .select(['location->>lat', 'location->>lng'])
          .single(),
      });
      assert<Equals<typeof row, { lat: string; lng: string }>>();
      expect(row).toMatchObject({ lat: '1.100000', lng: '2.200000' });
    });

    it('vertical filtering with rename', async () => {
      const { row } = await pgClient.get({
        query: pgClient
          .query('countries')
          .eq('id', 1)
          .select(['languages->>0', { name: 'primary_language' }])
          .single(),
      });
      expect(row).toMatchObject({ primary_language: 'en' });
    });
  });

  describe('JSON and composite renaming', () => {
    it('single JSON', async () => {
      const { row } = await pgClient.get({
        query: pgClient
          .query('people')
          .eq('id', 1)
          .select(['json_data->>blood_type', { name: 'bloodType' }])
          .single(),
      });
      assert<Equals<typeof row.bloodType, string>>();
      expect(row.bloodType).toBeTypeOf('string');
    });

    it('multi JSON', async () => {
      const { row } = await pgClient.get({
        query: pgClient
          .query('people')
          .eq('id', 1)
          .select([
            ['json_data->>blood_type', { name: 'bloodType' }],
            ['json_data->phones->0->>country_code', { name: 'countryCode' }],
          ])
          .single(),
      });
      assert<Equals<typeof row.bloodType, string>>();
      assert<Equals<typeof row.countryCode, string>>();
      expect(row.bloodType).toBeTypeOf('string');
      expect(row.countryCode).toBeTypeOf('string');
    });

    it('single typed JSON', async () => {
      const { row } = await pgClient.get({
        query: pgClient
          .query('people')
          .eq('id', 1)
          .selectJson<{ bloodType: string }>([
            'json_data->blood_type',
            { name: 'bloodType' },
          ])
          .single(),
      });
      assert<Equals<typeof row.bloodType, string>>();
      expect(row.bloodType).toBeTypeOf('string');
    });

    it('multi typed JSON', async () => {
      const { row } = await pgClient.get({
        query: pgClient
          .query('people')
          .eq('id', 1)
          .selectJson<{ bloodType: string; countryCode: number }>([
            ['json_data->blood_type', { name: 'bloodType' }],
            ['json_data->phones->0->country_code', { name: 'countryCode' }],
          ])
          .single(),
      });
      assert<Equals<typeof row.bloodType, string>>();
      assert<Equals<typeof row.countryCode, number>>();
      expect(row.bloodType).toBeTypeOf('string');
      expect(row.countryCode).toBeTypeOf('number');
    });

    it('single composite', async () => {
      const { row } = await pgClient.get({
        query: pgClient
          .query('countries')
          .eq('id', 1)
          .select(['location->>lat', { name: 'latitude' }])
          .single(),
      });
      assert<Equals<typeof row, { latitude: string }>>();
      expect(row.latitude).toBeTypeOf('string');
    });

    it('multi composite', async () => {
      const { row } = await pgClient.get({
        query: pgClient
          .query('countries')
          .eq('id', 1)
          .select([
            ['location->>lat', { name: 'latitude' }],
            ['location->>lng', { name: 'longitude' }],
          ])
          .single(),
      });
      assert<Equals<typeof row, { latitude: string; longitude: string }>>();
      expect(row.latitude).toBeTypeOf('string');
      expect(row.longitude).toBeTypeOf('string');
    });

    it('single typed composite', async () => {
      const { row } = await pgClient.get({
        query: pgClient
          .query('countries')
          .eq('id', 1)
          .selectJson<{ latitude: number }>([
            'location->lat',
            { name: 'latitude' },
          ])
          .single(),
      });
      assert<Equals<typeof row, { latitude: number }>>();
      expect(row.latitude).toBeTypeOf('number');
    });

    it('multi typed composite', async () => {
      const { row } = await pgClient.get({
        query: pgClient
          .query('countries')
          .eq('id', 1)
          .selectJson<{ latitude: number; longitude: number }>([
            ['location->lat', { name: 'latitude' }],
            ['location->lng', { name: 'longitude' }],
          ])
          .single(),
      });
      assert<Equals<typeof row, { latitude: number; longitude: number }>>();
      expect(row.latitude).toBeTypeOf('number');
      expect(row.longitude).toBeTypeOf('number');
    });
  });

  describe('encoding', () => {
    describe.each([
      ['encoded', true],
      ['decoded', false],
    ])('%s', (_name, encodeQueryStrings) => {
      it('simple', async () => {
        const pgClient = new PostgrestClient<DB>({
          base: BASE_URL,
          encodeQueryStrings,
        });
        const query = pgClient
          .query('actors')
          .eq('id', 1)
          .select(['first_name', 'last_name'])
          .single();
        const { status } = await pgClient.get({ query });
        expect(status).toBe(200);
      });
    });
  });
});
