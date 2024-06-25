import { PostgresTable } from '../../src/types';

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

export default DB;
