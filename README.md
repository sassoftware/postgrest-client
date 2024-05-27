# PostgREST Client

**General purpose type-safe TypeScript client for PostgREST.**

## Table of Contents

- [Overview](#overview)
- [Contributing](#contributing)
- [License](#license)
- [Additional Resources](#additional-resources)

## Overview

The PostgREST Client is a type-safe TypeScript client designed for use with PostgREST. It allows for efficient and straightforward interaction with PostgREST APIs, offering a comprehensive suite of features for various operations.

![demo](https://github.com/sassoftware/postgrest-client/blob/main/docs/demo.gif)

### Features

- 🔳 Read
  - 🔳 Horizontal filtering
    - 🔳 Operators
    - ✅ Logical operators
    - ⬜ Operator modifiers
    - 🔳 Pattern matching
    - ⬜ Full-text search
  - ✅ Vertical filtering
    - ✅ Renaming columns
    - ✅ Casting columns
    - ✅ JSON columns
    - ✅ Composite/Array columns
    - ✅ Ordering
    - ✅ Limits and pagination
    - ✅ Count
- ✅ Head
- ✅ Insert
  - ✅ `prefer: return=` header
  - ✅ Bulk insert
  - ✅ `prefer: missing=` header
  - ✅ specifying columns
- ✅ Update
  - ✅ Limited update
- ✅ Upsert
  - ✅ `prefer: resolution=` header
  - ✅ On conflict
- ✅ Put
- ✅ Delete
  - ✅ `prefer: return=` header
  - ✅ Limited delete
- ⬜ Stored procedures
- 🔳 Schemas
- 🔳 Resource embedding
  - ✅ Foreign key joins
  - ✅ Foreign key joins on write
  - ✅ Nested embedding
  - ✅ Embedded filtering
  - ✅ Top-level filtering
  - ⬜ Null filtering
  - ✅ Empty embedded
  - ✅ Embedded ordering
  - ⬜ Top-level ordering
  - ⬜ Spread embedded resources
- 🔳 Resource representation
  - ✅ Singular or plural
  - ⬜ Stripped nulls
  - ⬜ Response format
- ⬜ Options method
- ✅ URL grammar
  - ✅ Unicode support
  - ✅ Table / Columns with spaces
  - ✅ Reserved characters

### Installation

To get started with the PostgREST Client detailed instructions are available in our [Getting Started Documentation](https://github.com/sassoftware/postgrest-client/blob/main/docs/getting-started.md).

### Examples

Using schema from [PostgREST documentation](https://postgrest.org/en/stable/references/api/resource_embedding.html#relationships) for examples.

```ts
import {
  PostgrestClient,
  type PostgresTable,
} from '@sassoftware/postgrest-client';

type DB = {
  films: PostgresTable<{ id: number; title: string }, 'id'>;
};

const pgClient = new PostgrestClient<DB>({ base: '/api' });
const { rows } = await pgClient.get({ query: pgClient.query('films') });
```

For more examples and detailed usage instructions, visit our [Queries Documentation](https://github.com/sassoftware/postgrest-client/blob/main/docs/queries.md).

## Contributing

We welcome your contributions! Please read [CONTRIBUTING.md](https://github.com/sassoftware/postgrest-client/blob/main/CONTRIBUTING.md) for details on how to submit contributions to this project.

## License

This project is licensed under the [Apache 2.0 License](https://github.com/sassoftware/postgrest-client/blob/main/LICENSE).

## Additional Resources

- [Getting Started Documentation](https://github.com/sassoftware/postgrest-client/blob/main/docs/getting-started.md)
- [Queries Documentation](https://github.com/sassoftware/postgrest-client/blob/main/docs/queries.md)
- More examples available in TSDocs
