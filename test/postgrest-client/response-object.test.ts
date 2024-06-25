import axios from 'axios';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { PostgrestClient } from '../../src/postgrest-client';
import { BASE_URL } from './constants';
import DB from './test-db';

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
          .query('directors')
          .eq('first_name', 'Stanley')
          .eq('last_name', 'Kubrick'),
      });
    });

    it('default', async () => {
      const { headers, status, statusText } = await pgClient.post({
        query: pgClient.query('directors'),
        data: { first_name: 'Stanley', last_name: 'Kubrick' },
      });
      expect(headers).toBeInstanceOf(Headers);
      expect(status).toBeTypeOf('number');
      expect(statusText).toBeTypeOf('string');
    });

    it('with return', async () => {
      const { headers, status, statusText, rows } = await pgClient.post({
        query: pgClient.query('directors').returning('representation'),
        data: { first_name: 'Stanley', last_name: 'Kubrick' },
      });
      expect(headers).toBeInstanceOf(Headers);
      expect(rows).toBeInstanceOf(Array);
      expect(status).toBeTypeOf('number');
      expect(statusText).toBeTypeOf('string');
    });

    it('with single return', async () => {
      const { headers, status, statusText, row } = await pgClient.post({
        query: pgClient.query('directors').returning('representation').single(),
        data: { first_name: 'Stanley', last_name: 'Kubrick' },
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
            .query('directors')
            .returning('representation')
            .count('exact'),
          data: { first_name: 'Stanley', last_name: 'Kubrick' },
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
            .query('directors')
            .returning('representation')
            .count('exact')
            .single(),
          data: { first_name: 'Stanley', last_name: 'Kubrick' },
        });
      expect(headers).toBeInstanceOf(Headers);
      expect(status).toBeTypeOf('number');
      expect(statusText).toBeTypeOf('string');
      expect(row).toBeTypeOf('object');
      expect(totalLength).toBeTypeOf('number');
    });
  });

  describe('patch', async () => {
    let actor: DB['directors']['get'];

    beforeEach(async () => {
      const { row } = await pgClient.post({
        query: pgClient.query('directors').returning('representation').single(),
        data: { first_name: 'Stanley', last_name: 'Kubrick' },
      });
      actor = row;
    });

    afterEach(async () => {
      await pgClient.delete({
        query: pgClient.query('directors').eq('id', actor.id),
      });
    });

    it('default', async () => {
      const { headers, status, statusText } = await pgClient.patch({
        query: pgClient.query('directors').eq('id', actor.id),
        data: { first_name: 'Stanley', last_name: 'Kubrick' },
      });
      expect(headers).toBeInstanceOf(Headers);
      expect(status).toBeTypeOf('number');
      expect(statusText).toBeTypeOf('string');
    });

    it('with return', async () => {
      const { headers, status, statusText, rows } = await pgClient.patch({
        query: pgClient
          .query('directors')
          .eq('id', actor.id)
          .returning('representation'),
        data: { first_name: 'Stanley', last_name: 'Kubrick' },
      });
      expect(headers).toBeInstanceOf(Headers);
      expect(rows).toBeInstanceOf(Array);
      expect(status).toBeTypeOf('number');
      expect(statusText).toBeTypeOf('string');
    });

    it('with single return', async () => {
      const { headers, status, statusText, row } = await pgClient.patch({
        query: pgClient
          .query('directors')
          .eq('id', actor.id)
          .returning('representation')
          .single(),
        data: { first_name: 'Stanley', last_name: 'Kubrick' },
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
            .query('directors')
            .eq('id', actor.id)
            .returning('representation')
            .count('exact'),
          data: { first_name: 'Stanley', last_name: 'Kubrick' },
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
            .query('directors')
            .eq('id', actor.id)
            .returning('representation')
            .count('exact')
            .single(),
          data: { first_name: 'Stanley', last_name: 'Kubrick' },
        });
      expect(headers).toBeInstanceOf(Headers);
      expect(status).toBeTypeOf('number');
      expect(statusText).toBeTypeOf('string');
      expect(row).toBeTypeOf('object');
      expect(totalLength).toBeTypeOf('number');
    });
  });

  describe('put', async () => {
    let actor: DB['directors']['get'];

    beforeEach(async () => {
      const { row } = await pgClient.post({
        query: pgClient.query('directors').returning('representation').single(),
        data: { first_name: 'Stanley', last_name: 'Kubrick' },
      });
      actor = row;
    });

    afterEach(async () => {
      await pgClient.delete({
        query: pgClient.query('directors').eq('id', actor.id),
      });
    });

    it('default', async () => {
      const { headers, status, statusText } = await pgClient.put({
        query: pgClient.query('directors').eq('id', actor.id),
        data: { first_name: 'Stanley', last_name: 'Kubrick', id: actor.id },
      });
      expect(headers).toBeInstanceOf(Headers);
      expect(status).toBeTypeOf('number');
      expect(statusText).toBeTypeOf('string');
    });

    it('with return', async () => {
      const { headers, status, statusText, rows } = await pgClient.put({
        query: pgClient
          .query('directors')
          .eq('id', actor.id)
          .returning('representation'),
        data: { first_name: 'Stanley', last_name: 'Kubrick', id: actor.id },
      });
      expect(headers).toBeInstanceOf(Headers);
      expect(rows).toBeInstanceOf(Array);
      expect(status).toBeTypeOf('number');
      expect(statusText).toBeTypeOf('string');
    });

    it('with single return', async () => {
      const { headers, status, statusText, row } = await pgClient.put({
        query: pgClient
          .query('directors')
          .eq('id', actor.id)
          .returning('representation')
          .single(),
        data: { first_name: 'Stanley', last_name: 'Kubrick', id: actor.id },
      });
      expect(headers).toBeInstanceOf(Headers);
      expect(status).toBeTypeOf('number');
      expect(statusText).toBeTypeOf('string');
      expect(row).toBeTypeOf('object');
    });

    it('with pagination', async () => {
      const { headers, status, statusText, rows } = await pgClient.put({
        query: pgClient
          .query('directors')
          .eq('id', actor.id)
          .returning('representation')
          .count('exact'),
        data: { first_name: 'Stanley', last_name: 'Kubrick', id: actor.id },
      });
      expect(headers).toBeInstanceOf(Headers);
      expect(rows).instanceOf(Array);
      expect(status).toBeTypeOf('number');
      expect(statusText).toBeTypeOf('string');
    });

    it('with single return and pagination', async () => {
      const { headers, status, statusText, row } = await pgClient.put({
        query: pgClient
          .query('directors')
          .eq('id', actor.id)
          .returning('representation')
          .count('exact')
          .single(),
        data: { first_name: 'Stanley', last_name: 'Kubrick', id: actor.id },
      });
      expect(headers).toBeInstanceOf(Headers);
      expect(status).toBeTypeOf('number');
      expect(statusText).toBeTypeOf('string');
      expect(row).toBeTypeOf('object');
    });
  });

  describe('delete', async () => {
    let actor: DB['directors']['get'];

    beforeEach(async () => {
      const { row } = await pgClient.post({
        query: pgClient.query('directors').returning('representation').single(),
        data: { first_name: 'Stanley', last_name: 'Kubrick' },
      });
      actor = row;
    });

    it('default', async () => {
      const { headers, status, statusText } = await pgClient.delete({
        query: pgClient.query('directors').eq('id', actor.id),
      });
      expect(headers).toBeInstanceOf(Headers);
      expect(status).toBeTypeOf('number');
      expect(statusText).toBeTypeOf('string');
    });

    it('with return', async () => {
      const { headers, status, statusText, rows } = await pgClient.delete({
        query: pgClient
          .query('directors')
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
          .query('directors')
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
            .query('directors')
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
            .query('directors')
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
