import { expect, it } from 'vitest';

import { PostgrestClient } from '../../src/postgrest-client';

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
