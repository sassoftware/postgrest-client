/*
Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/

import axios from 'axios';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { assert, Equals } from 'tsafe';

import {
  PostgrestClient,
  QueryResponseGet,
  createClient,
} from '../src/postgrest-client';
import { AlphabeticTypes, NumericTypes, PostgresTable } from '../src/types';

const BASE_URL = 'http://server:9000/';

type Actors = PostgresTable<
  { id: number; first_name: string; last_name: string },
  'id'
>;

type Directors = PostgresTable<
  { id: number; first_name: string; last_name: string },
  'id'
>;

type Films = PostgresTable<
  {
    id: number;
    director_id: number;
    title: string;
    year: number;
    rating: number;
    language: string;
  },
  'id'
>;

type TechnicalSpecs = PostgresTable<{
  film_id: number;
  runtime: string;
  camera: string;
  sound: string;
}>;

type Roles = PostgresTable<
  {
    film_id: number;
    actor_id: number;
    character: string;
  },
  'film_id' | 'actor_id'
>;

type Competitions = PostgresTable<
  {
    id: number;
    name: string;
    year: number;
  },
  'id'
>;

type Nominations = PostgresTable<
  {
    competition_id: number;
    film_id: number;
    rank: number;
  },
  'competition_id' | 'film_id'
>;

type Countries = PostgresTable<
  {
    id: number;
    location: { lat: number; lng: number };
    languages: string[];
  },
  'id'
>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type People = PostgresTable<{ id: number; json_data: any }, 'id'>;

type EmptyTable = PostgresTable<{ id: number }, 'id'>;

type Foo = PostgresTable<
  { id: number; bar: string; baz: number },
  'id' | 'bar' | 'baz'
>;

type DB = {
  actors: Actors;
  directors: Directors;
  films: Films;
  technical_specs: TechnicalSpecs;
  roles: Roles;
  competitions: Competitions;
  nominations: Nominations;
  countries: Countries;
  people: People;
  empty: EmptyTable;
  foo: Foo;
};

describe('Postgrest Client', () => {
  it('constructor', () => {
    const clientClassInstance = new PostgrestClient<DB>({ base: '/api/' });
    const clientFnInstance = createClient<DB>({ base: '/api/' });
    expect(clientClassInstance).toEqual(clientFnInstance);
  });

  describe('instance configs', () => {
    it('base with trailing slash', async () => {
      const pgClient = new PostgrestClient<DB>({ base: 'http://server:9000/' });
      const query = pgClient.query('actors');
      const { status, rows } = await pgClient.get({ query });
      assert<Equals<typeof status, number>>();
      assert<
        Equals<
          typeof rows,
          { id: number; first_name: string; last_name: string }[]
        >
      >();
      expect(status).toBe(200);
      expect(rows).toHaveLength(3);
    });

    it('base without trailing slash', async () => {
      const pgClient = new PostgrestClient<DB>({ base: 'http://server:9000' });
      const query = pgClient.query('actors');
      const { status, rows } = await pgClient.get({ query });
      assert<Equals<typeof status, number>>();
      assert<
        Equals<
          typeof rows,
          { id: number; first_name: string; last_name: string }[]
        >
      >();
      expect(status).toBe(200);
      expect(rows).toHaveLength(3);
    });

    it('encodeQueryStrings default setting', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch');

      const pgClient = new PostgrestClient<DB>({ base: BASE_URL });

      const query = pgClient
        .query('actors')
        .eq('id', 1)
        .select(['first_name', 'last_name'])
        .single();

      await pgClient.get({ query });
      expect(fetchSpy.mock.calls[0][0]).toEqual(
        'http://server:9000/actors?select=first_name%2Clast_name&id=eq.1',
      );
    });

    it('encodeQueryStrings set to false', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch');

      const pgClient = new PostgrestClient<DB>({
        base: BASE_URL,
        encodeQueryStrings: false,
      });

      const query = pgClient
        .query('actors')
        .eq('id', 1)
        .select(['first_name', 'last_name'])
        .single();

      await pgClient.get({ query });
      expect(fetchSpy.mock.calls[0][0]).toEqual(
        'http://server:9000/actors?select=first_name,last_name&id=eq.1',
      );
    });
  });

  describe.each([
    ['fetch', undefined],
    ['axios', axios.create()],
  ])('%s', (_name, axiosInstance) => {
    const pgClient = new PostgrestClient<DB>({ base: BASE_URL, axiosInstance });

    describe('get', () => {
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
          Equals<
            typeof row,
            { id: number; first_name: string; last_name: string }
          >
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
          const { rows, pagesLength, totalLength, status } = await pgClient.get(
            { query },
          );

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
          const { rows, totalLength, pagesLength, status } = await pgClient.get(
            { query },
          );

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
          const { rows, pagesLength, totalLength, status } = await pgClient.get(
            { query },
          );

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
          const { rows, pagesLength, totalLength, status } = await pgClient.get(
            { query },
          );

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
            const { rows, pagesLength, totalLength, status } =
              await pgClient.get({ query });
            expect(status).toBe(200);
            expect(rows).toHaveLength(0);
            expect(pagesLength).toBe(1);
            expect(totalLength).toBe(0);
          });

          it('limit 10', async () => {
            const query = pgClient.query('empty').count('exact').limit(10);
            const { rows, pagesLength, totalLength, status } =
              await pgClient.get({ query });
            expect(status).toBe(200);
            expect(rows).toHaveLength(0);
            expect(pagesLength).toBe(1);
            expect(totalLength).toBe(0);
          });
        });

        describe('pagination', async () => {
          it('last page (10)', async () => {
            const query = pgClient.query('actors').count('exact').limit(10);
            const { rows, pagesLength, totalLength, status } =
              await pgClient.get({ query });

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
            const { rows, pagesLength, totalLength, status } =
              await pgClient.get({ query });

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
                pgClient
                  .embeddedQuery('directors', 'one', 'not null')
                  .select('*'),
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
                pgClient
                  .embeddedQuery('directors', 'one', 'not null')
                  .select('*'),
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
          ).rejects.toThrowError(
            'Incorrect cardinality "many" for embedded query',
          );

          const arrayRes = pgClient
            .query('directors')
            .select(pgClient.embeddedQuery('films', 'one').select('*'));
          await expect(() =>
            pgClient.get({ query: arrayRes }),
          ).rejects.toThrowError(
            'Incorrect cardinality "one" for embedded query',
          );
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
                pgClient
                  .embeddedQuery('directors', 'one', 'not null')
                  .select('*'),
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
                pgClient
                  .embeddedQuery('directors', 'one', 'not null')
                  .select('*'),
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

        describe('top level ordering', () => {
          it('simple', async () => {
            const { rows } = await pgClient.get({
              query: pgClient
                .query('films')
                .select('title')
                .select(
                  pgClient
                    .embeddedQuery('directors', 'one')
                    .select('*')
                    .order([{ column: 'last_name', top: true }]),
                ),
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
                .select(
                  pgClient
                    .embeddedQuery('directors', 'one')
                    .select('*')
                    .order([{ column: 'last_name', top: true, order: 'desc' }]),
                ),
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
            console.log(
              pgClient
                .query('films')
                .select('title')
                .select(
                  pgClient
                    .embeddedQuery('directors', 'one')
                    .select('*')
                    .order([{ column: 'last_name', top: true }]),
                )
                .order([{ column: 'year', order: 'desc' }])
                .toString({ encoded: false }),
            );
            const { rows } = await pgClient.get({
              query: pgClient
                .query('films')
                .select('title')
                .select(
                  pgClient
                    .embeddedQuery('directors', 'one')
                    .select('*')
                    .order([{ column: 'last_name', top: true }]),
                )
                .order([{ column: 'year', order: 'desc' }]),
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
                  pgClient
                    .embeddedQuery('directors', 'one')
                    .select('*')
                    .order([{ column: 'last_name', top: true }]),
                  { name: 'director' },
                ]),
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
              }>([
                'json_data->blood_type',
                'json_data->phones->0->country_code',
              ])
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
                [
                  'json_data->phones->0->>country_code',
                  { name: 'countryCode' },
                ],
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

    describe('head', () => {
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

    describe('post', () => {
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
        assert<
          Equals<typeof row, { id: number; name: string; year: number }>
        >();
        expect(status).toBe(201);
        expect(row).toMatchObject(data);
      });

      it('return representation (array)', async () => {
        const query = pgClient
          .query('competitions')
          .returning('representation');
        const data = { name: 'Academy Awards', year: 2023 };
        const { status, rows } = await pgClient.post({
          query,
          data,
        });
        assert<Equals<typeof status, number>>();
        assert<
          Equals<typeof rows, { id: number; name: string; year: number }[]>
        >();
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
        const query = pgClient
          .query('people')
          .returning('representation')
          .single();
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

    describe('patch', () => {
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
        assert<
          Equals<typeof row, { id: number; name: string; year: number }>
        >();
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
        assert<
          Equals<typeof rows, { id: number; name: string; year: number }[]>
        >();
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

    describe('put', () => {
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

    describe('delete', () => {
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

    describe('casting', () => {
      const pgClient = new PostgrestClient<DB>({ base: 'http://server:9000' });

      it.each([
        'smallint',
        'integer',
        'decimal',
        'float',
        'numeric',
        'real',
      ] as NumericTypes[])('chaining numeric "%s"', async (cast) => {
        const query = pgClient.query('competitions');
        const insertedRes = await pgClient.post({
          query: query.returning('representation').single(),
          data: { name: '100', year: 2023 },
        });

        const { row } = await pgClient.get({
          query: query
            .eq('id', insertedRes.row.id)
            .select(['name', { cast }])
            .single(),
        });

        assert<Equals<typeof row.name, number>>();
        expect(row.name).toBeTypeOf('number');
      });

      it.each(['text', 'character', 'money'] as AlphabeticTypes[])(
        'chaining alphabetic "%s"',
        async (cast) => {
          const query = pgClient.query('competitions');
          const insertedRes = await pgClient.post({
            query: query.returning('representation').single(),
            data: { name: '100', year: 2023 },
          });

          const { row } = await pgClient.get({
            query: query
              .eq('id', insertedRes.row.id)
              .select(['year', { cast }])
              .single(),
          });

          assert<Equals<typeof row.year, string>>();
          expect(row.year).toBeTypeOf('string');
        },
      );

      it('chaining alphabetic "bytea"', async () => {
        const query = pgClient.query('competitions');
        const insertedRes = await pgClient.post({
          query: query.returning('representation').single(),
          data: { name: '100', year: 2023 },
        });

        const { row } = await pgClient.get({
          query: query
            .eq('id', insertedRes.row.id)
            .select(['name', { cast: 'bytea' }])
            .single(),
        });

        assert<Equals<typeof row.name, string>>();
        expect(row.name).toBeTypeOf('string');
        expect(row.name).toBe('\\x313030');
      });

      it.each([
        'smallint',
        'integer',
        'decimal',
        'float',
        'numeric',
        'real',
      ] as NumericTypes[])('array selector numeric "%s"', async (cast) => {
        const query = pgClient.query('competitions');
        const insertedRes = await pgClient.post({
          query: query.returning('representation').single(),
          data: { name: '100', year: 2023 },
        });

        const { row } = await pgClient.get({
          query: query
            .eq('id', insertedRes.row.id)
            .select(['id', ['name', { cast }]])
            .single(),
        });

        assert<Equals<typeof row.name, number>>();
        expect(row.name).toBeTypeOf('number');
      });

      it.each(['text', 'character', 'money'] as AlphabeticTypes[])(
        'array selector alphabetic "%s"',
        async (cast) => {
          const query = pgClient.query('competitions');
          const insertedRes = await pgClient.post({
            query: query.returning('representation').single(),
            data: { name: '100', year: 2023 },
          });

          const { row } = await pgClient.get({
            query: query
              .eq('id', insertedRes.row.id)
              .select(['id', ['year', { cast }]])
              .single(),
          });

          assert<Equals<typeof row.year, string>>();
          expect(row.year).toBeTypeOf('string');
        },
      );

      it('array selector alphabetic "bytea"', async () => {
        const query = pgClient.query('competitions');
        const insertedRes = await pgClient.post({
          query: query.returning('representation').single(),
          data: { name: '100', year: 2023 },
        });

        const { row } = await pgClient.get({
          query: query
            .eq('id', insertedRes.row.id)
            .select(['id', ['name', { cast: 'bytea' }]])
            .single(),
        });

        assert<Equals<typeof row.name, string>>();
        expect(row.name).toBeTypeOf('string');
        expect(row.name).toBe('\\x313030');
      });
    });
  });

  describe('dynamic - no DB types', () => {
    it('basic', async () => {
      const pgClient = new PostgrestClient({ base: 'http://server:9000' });
      const query = pgClient.query('actors');
      const res = await pgClient.get({ query });
      expect(res.status).toBe(200);
      expect(res.rows[0]).toMatchObject({ id: 1 });
    });

    it('to-one (single row - object)', async () => {
      const pgClient = new PostgrestClient({ base: 'http://server:9000' });
      const query = pgClient.query('actors').limit(1).single();
      const res = await pgClient.get({ query });
      expect(res.status).toBe(200);
      expect(res.row).toMatchObject({ id: 1 });
    });

    it('count', async () => {
      const pgClient = new PostgrestClient({ base: 'http://server:9000' });
      const query = pgClient.query('actors').count('exact');
      const res = await pgClient.get({ query });
      expect(res.status).toBe(200);
      expect(res.totalLength).toBe(3);
    });
  });
});

describe('special characters', () => {
  describe.each([
    ['fetch unencoded', undefined, false],
    ['fetch encoded', undefined, true],
    ['axios unencoded', axios.create(), false],
    ['axios encoded', axios.create(), true],
  ])('%s', (_name, axiosInstance, encodeQueryStrings) => {
    const pgClient = new PostgrestClient<DB>({
      base: BASE_URL,
      axiosInstance,
      encodeQueryStrings,
    });

    let testRow;
    const specialCharsStr = ',.:() "\'\\';
    const reversedSpecialCharsStr = specialCharsStr
      .split('')
      .reverse()
      .join('');

    beforeAll(async () => {
      ({ row: testRow } = await pgClient.post({
        query: pgClient.query('actors').returning('representation').single(),
        data: {
          first_name: specialCharsStr,
          last_name: specialCharsStr,
        },
      }));

      await pgClient.post({
        query: pgClient.query('actors'),
        data: [...specialCharsStr].map((specialChar) => ({
          first_name: specialChar,
          last_name: specialChar,
        })),
      });
    });

    afterAll(async () => {
      // cleanup
      await pgClient.delete({
        query: pgClient.query('actors').eq('id', testRow.id),
      });

      const { totalLength } = await pgClient.delete({
        query: pgClient
          .query('actors')
          .in('first_name', [...specialCharsStr])
          .count('exact'),
      });

      if (totalLength !== specialCharsStr.length) {
        throw new Error('Cleanup failed');
      }
    });

    it('create and update', async () => {
      expect(testRow.first_name).toBe(specialCharsStr);

      const { row: putRow } = await pgClient.put({
        query: pgClient
          .query('actors')
          .eq('id', testRow.id)
          .returning('representation')
          .single(),
        data: {
          ...testRow,
          first_name: reversedSpecialCharsStr,
        },
      });

      expect(putRow.first_name).toBe(reversedSpecialCharsStr);

      const { row: patchRow } = await pgClient.patch({
        query: pgClient
          .query('actors')
          .eq('id', testRow.id)
          .returning('representation')
          .single(),
        data: {
          first_name: specialCharsStr,
        },
      });

      expect(patchRow.first_name).toBe(specialCharsStr);
    });

    describe.each(Array.from(specialCharsStr))(`char "%s"`, (specialChar) => {
      it('simple filter', async () => {
        const eqQueryRes = await pgClient.get({
          query: pgClient
            .query('actors')
            .eq('first_name', specialChar)
            .count('exact'),
        });
        expect(eqQueryRes.totalLength).toBe(1);
      });

      it('in filter', async () => {
        const eqQueryRes = await pgClient.get({
          query: pgClient
            .query('actors')
            .in('first_name', [specialChar])
            .count('exact'),
        });
        expect(eqQueryRes.totalLength).toBe(1);
      });

      it('simple logical filter', async () => {
        const eqQueryRes = await pgClient.get({
          query: pgClient
            .query('actors')
            .or((q) => [
              q.eq('first_name', specialChar),
              q.eq('last_name', specialChar),
            ])
            .count('exact'),
        });

        expect(eqQueryRes.totalLength).toBe(1);
      });
    });
  });
});

describe('response object', () => {
  describe.each([
    ['fetch', undefined],
    ['axios', axios.create()],
  ])('%s', (_name, axiosInstance) => {
    const pgClient = new PostgrestClient<DB>({ base: BASE_URL, axiosInstance });

    describe('get', () => {
      it('default', async () => {
        const { headers, rows, status, statusText } = await pgClient.get({
          query: pgClient.query('actors'),
        });
        expect(headers).toBeInstanceOf(Headers);
        expect(rows).toBeInstanceOf(Array);
        expect(status).toBeTypeOf('number');
        expect(statusText).toBeTypeOf('string');
      });

      it('with pagination', async () => {
        const { headers, rows, status, statusText, pagesLength, totalLength } =
          await pgClient.get({
            query: pgClient.query('actors').count('exact'),
          });
        expect(headers).toBeInstanceOf(Headers);
        expect(rows).toBeInstanceOf(Array);
        expect(status).toBeTypeOf('number');
        expect(statusText).toBeTypeOf('string');
        expect(pagesLength).toBeTypeOf('number');
        expect(totalLength).toBeTypeOf('number');
      });

      it('single', async () => {
        const { headers, row, status, statusText } = await pgClient.get({
          query: pgClient.query('actors').eq('id', 1).single(),
        });
        expect(headers).toBeInstanceOf(Headers);
        expect(row).toBeTypeOf('object');
        expect(status).toBeTypeOf('number');
        expect(statusText).toBeTypeOf('string');
      });
    });

    describe('head', async () => {
      it('default', async () => {
        const { headers, status, statusText } = await pgClient.head({
          query: pgClient.query('actors'),
        });
        expect(headers).toBeInstanceOf(Headers);
        expect(status).toBeTypeOf('number');
        expect(statusText).toBeTypeOf('string');
      });

      it('with pagination', async () => {
        const { headers, status, statusText, pagesLength, totalLength } =
          await pgClient.head({
            query: pgClient.query('actors').count('exact'),
          });
        expect(headers).toBeInstanceOf(Headers);
        expect(status).toBeTypeOf('number');
        expect(statusText).toBeTypeOf('string');
        expect(pagesLength).toBeTypeOf('number');
        expect(totalLength).toBeTypeOf('number');
      });

      it('single', async () => {
        const { headers, status, statusText } = await pgClient.head({
          query: pgClient.query('actors').eq('id', 1).single(),
        });
        expect(headers).toBeInstanceOf(Headers);
        expect(status).toBeTypeOf('number');
        expect(statusText).toBeTypeOf('string');
      });
    });

    describe('post', () => {
      afterEach(async () => {
        await pgClient.delete({
          query: pgClient
            .query('actors')
            .eq('first_name', 'Peter')
            .eq('last_name', 'Sellers'),
        });
      });

      it('default', async () => {
        const { headers, status, statusText } = await pgClient.post({
          query: pgClient.query('actors'),
          data: { first_name: 'Peter', last_name: 'Sellers' },
        });
        expect(headers).toBeInstanceOf(Headers);
        expect(status).toBeTypeOf('number');
        expect(statusText).toBeTypeOf('string');
      });

      it('with return', async () => {
        const { headers, status, statusText, rows } = await pgClient.post({
          query: pgClient.query('actors').returning('representation'),
          data: { first_name: 'Peter', last_name: 'Sellers' },
        });
        expect(headers).toBeInstanceOf(Headers);
        expect(rows).toBeInstanceOf(Array);
        expect(status).toBeTypeOf('number');
        expect(statusText).toBeTypeOf('string');
      });

      it('with single return', async () => {
        const { headers, status, statusText, row } = await pgClient.post({
          query: pgClient.query('actors').returning('representation').single(),
          data: { first_name: 'Peter', last_name: 'Sellers' },
        });
        expect(headers).toBeInstanceOf(Headers);
        expect(status).toBeTypeOf('number');
        expect(statusText).toBeTypeOf('string');
        expect(row).toBeTypeOf('object');
      });

      it('with pagination', async () => {
        const { headers, status, statusText, rows, totalLength } =
          await pgClient.post({
            query: pgClient
              .query('actors')
              .returning('representation')
              .count('exact'),
            data: { first_name: 'Peter', last_name: 'Sellers' },
          });
        expect(headers).toBeInstanceOf(Headers);
        expect(rows).instanceOf(Array);
        expect(status).toBeTypeOf('number');
        expect(statusText).toBeTypeOf('string');
        expect(totalLength).toBeTypeOf('number');
      });

      it('with single return and pagination', async () => {
        const { headers, status, statusText, row, totalLength } =
          await pgClient.post({
            query: pgClient
              .query('actors')
              .returning('representation')
              .count('exact')
              .single(),
            data: { first_name: 'Peter', last_name: 'Sellers' },
          });
        expect(headers).toBeInstanceOf(Headers);
        expect(status).toBeTypeOf('number');
        expect(statusText).toBeTypeOf('string');
        expect(row).toBeTypeOf('object');
        expect(totalLength).toBeTypeOf('number');
      });
    });

    describe('patch', async () => {
      let actor: DB['actors']['get'];

      beforeEach(async () => {
        const { row } = await pgClient.post({
          query: pgClient.query('actors').returning('representation').single(),
          data: { first_name: 'Peter', last_name: 'Sellers' },
        });
        actor = row;
      });

      afterEach(async () => {
        await pgClient.delete({
          query: pgClient.query('actors').eq('id', actor.id),
        });
      });

      it('default', async () => {
        const { headers, status, statusText } = await pgClient.patch({
          query: pgClient.query('actors').eq('id', actor.id),
          data: { first_name: 'Peter', last_name: 'Sellers' },
        });
        expect(headers).toBeInstanceOf(Headers);
        expect(status).toBeTypeOf('number');
        expect(statusText).toBeTypeOf('string');
      });

      it('with return', async () => {
        const { headers, status, statusText, rows } = await pgClient.patch({
          query: pgClient
            .query('actors')
            .eq('id', actor.id)
            .returning('representation'),
          data: { first_name: 'Peter', last_name: 'Sellers' },
        });
        expect(headers).toBeInstanceOf(Headers);
        expect(rows).toBeInstanceOf(Array);
        expect(status).toBeTypeOf('number');
        expect(statusText).toBeTypeOf('string');
      });

      it('with single return', async () => {
        const { headers, status, statusText, row } = await pgClient.patch({
          query: pgClient
            .query('actors')
            .eq('id', actor.id)
            .returning('representation')
            .single(),
          data: { first_name: 'Peter', last_name: 'Sellers' },
        });
        expect(headers).toBeInstanceOf(Headers);
        expect(status).toBeTypeOf('number');
        expect(statusText).toBeTypeOf('string');
        expect(row).toBeTypeOf('object');
      });

      it('with pagination', async () => {
        const { headers, status, statusText, rows, totalLength } =
          await pgClient.patch({
            query: pgClient
              .query('actors')
              .eq('id', actor.id)
              .returning('representation')
              .count('exact'),
            data: { first_name: 'Peter', last_name: 'Sellers' },
          });
        expect(headers).toBeInstanceOf(Headers);
        expect(rows).instanceOf(Array);
        expect(status).toBeTypeOf('number');
        expect(statusText).toBeTypeOf('string');
        expect(totalLength).toBeTypeOf('number');
      });

      it('with single return and pagination', async () => {
        const { headers, status, statusText, row, totalLength } =
          await pgClient.patch({
            query: pgClient
              .query('actors')
              .eq('id', actor.id)
              .returning('representation')
              .count('exact')
              .single(),
            data: { first_name: 'Peter', last_name: 'Sellers' },
          });
        expect(headers).toBeInstanceOf(Headers);
        expect(status).toBeTypeOf('number');
        expect(statusText).toBeTypeOf('string');
        expect(row).toBeTypeOf('object');
        expect(totalLength).toBeTypeOf('number');
      });
    });

    describe('put', async () => {
      let actor: DB['actors']['get'];

      beforeEach(async () => {
        const { row } = await pgClient.post({
          query: pgClient.query('actors').returning('representation').single(),
          data: { first_name: 'Peter', last_name: 'Sellers' },
        });
        actor = row;
      });

      afterEach(async () => {
        await pgClient.delete({
          query: pgClient.query('actors').eq('id', actor.id),
        });
      });

      it('default', async () => {
        const { headers, status, statusText } = await pgClient.put({
          query: pgClient.query('actors').eq('id', actor.id),
          data: { first_name: 'Peter', last_name: 'Sellers', id: actor.id },
        });
        expect(headers).toBeInstanceOf(Headers);
        expect(status).toBeTypeOf('number');
        expect(statusText).toBeTypeOf('string');
      });

      it('with return', async () => {
        const { headers, status, statusText, rows } = await pgClient.put({
          query: pgClient
            .query('actors')
            .eq('id', actor.id)
            .returning('representation'),
          data: { first_name: 'Peter', last_name: 'Sellers', id: actor.id },
        });
        expect(headers).toBeInstanceOf(Headers);
        expect(rows).toBeInstanceOf(Array);
        expect(status).toBeTypeOf('number');
        expect(statusText).toBeTypeOf('string');
      });

      it('with single return', async () => {
        const { headers, status, statusText, row } = await pgClient.put({
          query: pgClient
            .query('actors')
            .eq('id', actor.id)
            .returning('representation')
            .single(),
          data: { first_name: 'Peter', last_name: 'Sellers', id: actor.id },
        });
        expect(headers).toBeInstanceOf(Headers);
        expect(status).toBeTypeOf('number');
        expect(statusText).toBeTypeOf('string');
        expect(row).toBeTypeOf('object');
      });

      it('with pagination', async () => {
        const { headers, status, statusText, rows } = await pgClient.put({
          query: pgClient
            .query('actors')
            .eq('id', actor.id)
            .returning('representation')
            .count('exact'),
          data: { first_name: 'Peter', last_name: 'Sellers', id: actor.id },
        });
        expect(headers).toBeInstanceOf(Headers);
        expect(rows).instanceOf(Array);
        expect(status).toBeTypeOf('number');
        expect(statusText).toBeTypeOf('string');
      });

      it('with single return and pagination', async () => {
        const { headers, status, statusText, row } = await pgClient.put({
          query: pgClient
            .query('actors')
            .eq('id', actor.id)
            .returning('representation')
            .count('exact')
            .single(),
          data: { first_name: 'Peter', last_name: 'Sellers', id: actor.id },
        });
        expect(headers).toBeInstanceOf(Headers);
        expect(status).toBeTypeOf('number');
        expect(statusText).toBeTypeOf('string');
        expect(row).toBeTypeOf('object');
      });
    });

    describe('delete', async () => {
      let actor: DB['actors']['get'];

      beforeEach(async () => {
        const { row } = await pgClient.post({
          query: pgClient.query('actors').returning('representation').single(),
          data: { first_name: 'Peter', last_name: 'Sellers' },
        });
        actor = row;
      });

      it('default', async () => {
        const { headers, status, statusText } = await pgClient.delete({
          query: pgClient.query('actors').eq('id', actor.id),
        });
        expect(headers).toBeInstanceOf(Headers);
        expect(status).toBeTypeOf('number');
        expect(statusText).toBeTypeOf('string');
      });

      it('with return', async () => {
        const { headers, status, statusText, rows } = await pgClient.delete({
          query: pgClient
            .query('actors')
            .eq('id', actor.id)
            .returning('representation'),
        });
        expect(headers).toBeInstanceOf(Headers);
        expect(rows).toBeInstanceOf(Array);
        expect(status).toBeTypeOf('number');
        expect(statusText).toBeTypeOf('string');
      });

      it('with single return', async () => {
        const { headers, status, statusText, row } = await pgClient.delete({
          query: pgClient
            .query('actors')
            .eq('id', actor.id)
            .returning('representation')
            .single(),
        });
        expect(headers).toBeInstanceOf(Headers);
        expect(status).toBeTypeOf('number');
        expect(statusText).toBeTypeOf('string');
        expect(row).toBeTypeOf('object');
      });

      it('with pagination', async () => {
        const { headers, status, statusText, rows, totalLength } =
          await pgClient.delete({
            query: pgClient
              .query('actors')
              .eq('id', actor.id)
              .returning('representation')
              .count('exact'),
          });
        expect(headers).toBeInstanceOf(Headers);
        expect(rows).instanceOf(Array);
        expect(status).toBeTypeOf('number');
        expect(statusText).toBeTypeOf('string');
        expect(totalLength).toBeTypeOf('number');
      });

      it('with single return and pagination', async () => {
        const { headers, status, statusText, row, totalLength } =
          await pgClient.delete({
            query: pgClient
              .query('actors')
              .eq('id', actor.id)
              .returning('representation')
              .count('exact')
              .single(),
          });
        expect(headers).toBeInstanceOf(Headers);
        expect(status).toBeTypeOf('number');
        expect(statusText).toBeTypeOf('string');
        expect(row).toBeTypeOf('object');
        expect(totalLength).toBeTypeOf('number');
      });
    });
  });
});
