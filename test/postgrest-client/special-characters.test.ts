import axios from 'axios';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PostgrestClient } from '../../src/postgrest-client';
import { BASE_URL } from './constants';
import DB from './test-db';

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
  const reversedSpecialCharsStr = specialCharsStr.split('').reverse().join('');

  beforeAll(async () => {
    ({ row: testRow } = await pgClient.post({
      query: pgClient.query('directors').returning('representation').single(),
      data: {
        first_name: specialCharsStr,
        last_name: specialCharsStr,
      },
    }));

    await pgClient.post({
      query: pgClient.query('directors'),
      data: [...specialCharsStr].map((specialChar) => ({
        first_name: specialChar,
        last_name: specialChar,
      })),
    });
  });

  afterAll(async () => {
    // cleanup
    await pgClient.delete({
      query: pgClient.query('directors').eq('id', testRow.id),
    });

    const { totalLength } = await pgClient.delete({
      query: pgClient
        .query('directors')
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
        .query('directors')
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
        .query('directors')
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
          .query('directors')
          .eq('first_name', specialChar)
          .count('exact'),
      });
      expect(eqQueryRes.totalLength).toBe(1);
    });

    it('in filter', async () => {
      const eqQueryRes = await pgClient.get({
        query: pgClient
          .query('directors')
          .in('first_name', [specialChar])
          .count('exact'),
      });
      expect(eqQueryRes.totalLength).toBe(1);
    });

    it('simple logical filter', async () => {
      const eqQueryRes = await pgClient.get({
        query: pgClient
          .query('directors')
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
