import { describe, expect, it, vi } from 'vitest';
import { Equals, assert } from 'tsafe';

import { PostgrestClient, createClient } from '../../src/postgrest-client';
import { BASE_URL } from './constants';
import DB from './test-db';

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
