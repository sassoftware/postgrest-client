## Queries

This document covers more complex queries and query features.
Most of the examples bellow use `GET` method but they are applicable for other methods too.

Database type for the following examples:

```ts
type Films = PostgresTable<
  {
    id: number;
    director_id: number | null;
    title: string | null;
    year: number | null;
    rating: number | null;
    language: string | null;
  },
  'id'
>;

type Directors = PostgresTable<
  { id: number; first_name: string | null; last_name: string | null },
  'id'
>;

type DB = { films: Films; directors: Directors };
```

### Select

Using array argument in `.select`:

```ts
const { rows } = await pgClient.get({
  query: pgClient.query('films').select(['id', 'title']),
});
// rows will have type Array<{ id: number; title: string | null }>
```

Using chaining:

```ts
const { rows } = await pgClient.get({
  query: pgClient.query('films').select('id').select('title'),
});
// rows will have type Array<{ id: number; title: string | null }>
```

#### Renaming

Using array argument in `.select`:

```ts
const { rows } = await pgClient.get({
  query: pgClient
    .query('films')
    .select(['id', ['title', { name: 'filmTitle' }]]),
});
// rows will have type Array<{ id: number; filmTitle: string | null }>
```

Using chaining:

```ts
const { rows } = await pgClient.get({
  query: pgClient
    .query('films')
    .select('id')
    .select(['title', { name: 'filmTitle' }]),
});
// rows will have type Array<{ id: number; filmTitle: string | null }>
```

#### Casting

Using array argument in `.select`:

```ts
const { rows } = await pgClient.get({
  query: pgClient.query('films').select([['id', { cast: 'text' }], 'title']),
});
// rows will have type Array<{ id: string; title: string | null }>
```

Using chaining:

```ts
const { rows } = await pgClient.get({
  query: pgClient
    .query('films')
    .select(['id', { cast: 'text' }])
    .select('title'),
});
// rows will have type Array<{ id: string; title: string | null }>
```

### Filter

```ts
const { rows } = await pgClient.get({
  query: pgClient
    .query('films')
    .not.eq('id', 1)
    .gte('rating', 4)
    .in('language', ['en', 'fr', 'es']),
});
```

#### Logical operators

```ts
const query = pgClient.query('films');
const { rows } = await pgClient.get({
  query: query
    .or([
      query.and([query.gte('year', 1990), query.lt('year', 2000)]),
      query.in('year', [2022, 2023]),
    ])
    .gt('rating', 3.5),
});
```

The same query, but using function parameter instead of assigning a variable:

```ts
const { rows } = await pgClient.get({
  query: pgClient
    .query('films')
    .or((q) => [
      q.and([q.gte('year', 1990), q.lt('year', 2000)]),
      q.in('year', [2022, 2023]),
    ])
    .gt('rating', 3.5),
});
```

### Count

Sending `Prefer: count=exact` with `limit` and `offset` parameters:

```ts
const { rows, pagesLength, totalLength } = await pgClient.get({
  query: pgClient.query('films').count('exact').limit(10).offset(10),
});
```

Notice the different response when `.get` request `query` parameter has `.count`. It has 2 additional properties - `pagesLength` and `totalLength`.

The same request using `.page` method instead:

```ts
const { rows, pagesLength, totalLength } = await pgClient.get({
  query: pgClient.query('films').count('exact').page(1, 10),
});
```

### Single object response

In case you want to fetch a single record and avoid array in the response:

```ts
const { row } = await pgClient.get({
  query: pgClient.query('films').limit(1).single(),
});
```

In the example above there's `row` instead of `rows` in the response object.
This should be used only when it's certain the response will have just 1 row.
In case there are more than 1, or no rows returned the response will have
non 200 response and `.get` will return a rejected promise.

### JSON columns and composite/array columns

There are 2 options to read JSON fields:

1. Using `.select('json_data->>prop')` (`->>` operator).
   This passed to requests will produce a response with `string` type.
2. Using typed method `.selectJson<{ prop: number }>('json_data->prop')` (`->` operator)

Example:

```ts
const { rows } = await pgClient.get({
  query: pgClient.query('people').select('json_data->>blood_type').selectJson<{
    country_code: number;
  }>('json_data->phones->0->country_code'),
});
// rows would have type Array<{ blood_type: string; country_code: number }>
```

These selectors are available in filters too (example: `.gte('json_data->age', 18)`)

## Ordering

```ts
const query = pgClient
  .query('films')
  .order([{ column: 'title', order: 'desc', nulls: 'last' }]);
```

## Embedding

`.select` method beside simple column names and JSON/composite selectors accepts embedded queries like `pgClient.embeddedQuery('another_table', 'many').select('*')` for embedded documents.
Note that `.embeddedQuery` is the same as `.query`, but it accepts more arguments to be able to return correct TypeScript response types. Database type definition doesn't have information about relations so that's up to developer to describe the relation "just in time" for the client to be able to return correct TypeScript types. JavaScript users can just use `.query` instead.

#### Examples

With "to-many" embedded records:

```ts
const { rows } = await pgClient.get({
  query: pgClient
    .query('directors')
    .select(['first_name', 'last_name'])
    .select(
      pgClient.embeddedQuery('films', 'many').select('title').select('year'),
    ),
});
/*
rows would have type Array<{
  first_name: string | null;
  last_name: string | null;
  directors: Array<{ title: string | null; year: number | null }>
}>
*/
```

**NOTE: `.select('title').select('year')` is essentially the same as `.select(['title', 'year'])`, but using array selectors in embedded queries with "to-many" cardinality is a known issue currently and it will produce wrong TypeScript type.**

With "to-one" embedded records, array selectors and rename:

```ts
const { rows } = await pgClient.get({
  query: pgClient.query('films').select([
    '*',
    [
      // 'not null' says that `directors` will always return non null value
      // When omitted `director` object would have type `{...} | null`
      pgClient
        .embeddedQuery('directors', 'one', 'not null')
        .select(['first_name', 'last_name']),
      { name: 'director' },
    ],
  ]),
});
/*
rows would have type Array<{
  id: number;
  director_id: number | null;
  title: string | null;
  year: number | null;
  rating: number | null;
  language: string | null;
  director: {
    first_name: string | null;
    last_name: string | null
  }
}>
*/
```

### Top level filtering

Filtering on embedded resources doesn't change the top level resource.
More information at https://postgrest.org/en/v12/references/api/resource_embedding.html#top-level-filtering.

`.inner()` method can be used to filter top level rows.
Example:

```ts
const { rows } = await pgClient.get({
  query: pgClient
    .query('directors')
    .select(pgClient.embeddedQuery('films', 'many').eq('year', 2024).inner()),
});
```

### Top level ordering

Used to sort "many-to-one" and "one-to-one" relationships.
For more information please see https://postgrest.org/en/v12/references/api/resource_embedding.html#top-level-ordering.

Example ordering films by director's last name:

```ts
const { rows } = await pgClient.get({
  query: pgClient
    .query('films')
    .select(pgClient.embeddedQuery('directors', 'one'))
    .order([{ column: 'directors.last_name' }]),
});
```

## Immutability

Update an existing record then fetch the first page:

```ts
const query = pgClient.query('films');
await pgClient.patch({
  query: query.eq('id', 5),
  data: { rating: 4.5 },
});
const { rows } = await pgClient.get({
  // the query is reusable.
  // it always returns a new immutable instance.
  // so this will be `films?offset=0&limit=10` (no `id=eq.5` from above)
  query: query.page(0, 10),
});
```

## POST/PUT/PATCH specific query methods

Adding `Prefer` headers.

### Return

```ts
const { rows } = await pgClient.post({
  query: pgClient.query('directors').returning('representation'),
  data: [{ first_name: 'Stanley', last_name: 'Kubrick' }],
});
```

### On Conflict

```ts
const res = await pgClient.post({
  query: pgClient.query('directors').onConflict('merge-duplicates'),
  data: [{ id: 1, first_name: 'Stanley', last_name: 'Kubrick' }],
});
```

In case these methods are called on a query passed to a `.get` method, they will be ignored.

---

More examples can be found in [tests](../test/postgrest-client.test.ts)
