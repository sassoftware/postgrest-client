/*
Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/

import { AxiosInstance, AxiosError } from 'axios';

import { Query, type QueryDataObject } from './query';
import type {
  BaseDB,
  Cardinality,
  DeleteQueryToResponse,
  GetQueryToResponse,
  HttpMethod,
  CountMetadata,
  PatchQueryToResponse,
  PatchRequestData,
  PostQueryToResponse,
  PostRequestData,
  PutRequestData,
  PutQueryToResponse,
} from './types';
import { PostgrestError, PostgrestErrorResponseData } from './postgrest-error';

export type { PostgresTable } from './types';
export { PostgrestError } from './postgrest-error';
export { Query } from './query';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type QueryResponseGet<Q extends Query<any, any>> =
  GetQueryToResponse<Q> & {
    /**
     * @deprecated
     * Backwards compatibility with postgrester
     */
    data: GetQueryToResponse<Q>['rows'];
    headers: Headers;
    status: number;
    statusText: string;
  };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type QueryResponsePost<Q extends Query<any, any>> =
  PostQueryToResponse<Q> & {
    headers: Headers;
    status: number;
    statusText: string;
  };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type QueryResponsePatch<Q extends Query<any, any>> =
  PatchQueryToResponse<Q> & {
    headers: Headers;
    status: number;
    statusText: string;
  };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type QueryResponsePut<Q extends Query<any, any>> =
  PutQueryToResponse<Q> & {
    headers: Headers;
    status: number;
    statusText: string;
  };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type QueryResponseDelete<Q extends Query<any, any>> =
  DeleteQueryToResponse<Q> & {
    headers: Headers;
    status: number;
    statusText: string;
  };

/**
 * A utility type useful as a type guard.
 * Axios has very similar function, but we want to avoid
 * using it to make it possible to use this package
 * without installing Axios.
 *
 * @param err Error, PostgrestError or any other
 * @returns `true` if the parameter is Axios error
 */
const isAxiosError = (err: unknown): err is AxiosError =>
  (err as AxiosError).isAxiosError === true;

type PostgrestClientConfig = {
  /**
   * Absolute base URL.
   * It could be path only or a URL with domain
   *
   * @example
   * base: '/api'
   * @example
   * base: 'https://example.com/api'
   */
  base: string;
  axiosInstance?: Pick<
    AxiosInstance,
    'get' | 'head' | 'post' | 'patch' | 'put' | 'delete'
  >;
  /**
   * Sets URL encoding to enabled/disabled.
   * Disabling encoding could help with debugging and provide better readability.
   *
   * @defaultValue `true` (enabled)
   */
  encodeQueryStrings?: boolean;
};

/**
 * Type-safe PostgREST client.
 */
export class PostgrestClient<DB extends BaseDB | never> {
  #base: PostgrestClientConfig['base'];
  #encodeQueryStrings: PostgrestClientConfig['encodeQueryStrings'];
  #axiosInstance?: PostgrestClientConfig['axiosInstance'];

  constructor({
    base,
    axiosInstance,
    encodeQueryStrings,
  }: PostgrestClientConfig) {
    /* c8 ignore next 3 */
    if (!this.#axiosInstance && typeof fetch !== 'function') {
      throw new Error('Neither Axios is provided nor "fetch" is available!');
    }

    this.#base = base;
    this.#axiosInstance = axiosInstance;
    this.#encodeQueryStrings = encodeQueryStrings;
  }

  /**
   * Creates an immutable chainable query instance with chainable filter methods.
   *
   * @param tableName Queried table name
   * @returns a Query object with filter methods
   */
  query<TableName extends keyof DB>(tableName: Extract<TableName, string>) {
    return new Query<DB, TableName>({ tableName });
  }

  /**
   * Typescript type modifier method.
   * The same as `.query(tableName)` but with more parameters
   * to help determine return type at compile time.
   *
   * @param tableName Queried table name
   * @param cardinality Cardinality for embedded types
   * @param notNull `'not null'` or omitted if embedded document could be `null`
   * @see https://postgrest.org/en/stable/references/api/resource_embedding.html
   * @returns a Query object with filter methods
   */
  embeddedQuery<TableName extends keyof DB, C extends 'many'>(
    tableName: Extract<TableName, string>,
    cardinality: C,
  ): Query<DB, TableName, C, null, object, { nullable: false }>;
  embeddedQuery<TableName extends keyof DB, C extends 'one'>(
    tableName: Extract<TableName, string>,
    cardinality: C,
    notNull?: never,
  ): Query<DB, TableName, C, null, object, { nullable: true }>;
  embeddedQuery<TableName extends keyof DB, C extends 'one'>(
    tableName: Extract<TableName, string>,
    cardinality: C,
    notNull: 'not null',
  ): Query<DB, TableName, C, null, object, { nullable: false }>;
  embeddedQuery<TableName extends keyof DB, C extends Cardinality>(
    tableName: Extract<TableName, string>,
    cardinality: C,
  ) {
    const query = new Query<DB, TableName, C>({ tableName, cardinality });
    if (cardinality === 'one') {
      query.single();
    }
    return query;
  }

  #getCountMetadata<Method extends HttpMethod, Q extends Query<DB, keyof DB>>(
    headers: Headers,
    limit: number | undefined,
  ): CountMetadata<Method, Q> {
    const contentRange = headers.get('content-range')?.split('/');
    const totalLength = Number(contentRange?.[1]);

    // TODO: fix the types
    return !isNaN(totalLength)
      ? ({
          pagesLength:
            limit && totalLength > 0 ? Math.ceil(totalLength / limit) : 1,
          totalLength,
        } as unknown as CountMetadata<Method, Q>)
      : ({} as CountMetadata<Method, Q>);
  }

  #transformResponse<T = unknown>({
    data,
    headers,
    ok,
    cardinality,
    queryObj,
  }: {
    /**
     * Data returned by fetch or axios
     */
    data?: T;
    /**
     * Response headers
     */
    headers: Headers;
    ok: Response['ok'];
    cardinality: Cardinality;
    queryObj: QueryDataObject<DB, keyof DB>;
  }) {
    const location = headers.get('location');
    const locationObj = location ? { location } : {};
    const countMetadataObj = this.#getCountMetadata(headers, queryObj.limit);

    if (ok && cardinality === 'many') {
      return data
        ? { rows: data, ...countMetadataObj, ...locationObj }
        : { ...countMetadataObj, ...locationObj };
    } else if (ok && cardinality === 'one') {
      return { row: data, ...countMetadataObj, ...locationObj };
    }

    return data;
  }

  #validateResponseCardinality<T extends Record<string, T>>({
    queryObj,
    data,
  }: {
    queryObj: QueryDataObject<DB, keyof DB>;
    data: T | T[];
  }) {
    const { cardinality } = queryObj;

    if (
      (cardinality === 'one' && Array.isArray(data)) ||
      (cardinality === 'many' && !Array.isArray(data))
    ) {
      throw new Error(
        `Incorrect cardinality "${cardinality}" for embedded query`,
      );
    }

    if (Array.isArray(data) && data.length === 0) {
      return;
    }

    const { select } = queryObj;

    select.forEach((s) => {
      if (
        typeof s === 'object' &&
        'query' in s &&
        'modifier' in s &&
        'name' in s.modifier
      ) {
        const name = s.modifier.name;
        this.#validateResponseCardinality({
          queryObj: s.query,
          data: Array.isArray(data) ? data[0][name] : data[name],
        });
        // NOTE: checking for "tableName" to figure out if it's a QueryDataObject
      } else if (typeof s === 'object' && 'tableName' in s) {
        const { tableName } = s as QueryDataObject<DB, keyof DB>;
        this.#validateResponseCardinality({
          queryObj: s as QueryDataObject<DB, keyof DB>,
          data: Array.isArray(data) ? data[0][tableName] : data[tableName],
        });
      }
    });
  }

  #getRequestUrl(tableName: string, query: Query<DB, keyof DB>): string {
    return `${this.#base}${
      this.#base.endsWith('/') ? '' : '/'
    }${tableName}?${query.toString({ encoded: this.#encodeQueryStrings })}`;
  }

  #getRequestHeaders(
    {
      cardinality,
      count,
      returning,
      resolution,
      missing,
    }: QueryDataObject<DB, keyof DB>,
    requestHeadersArg?: Headers,
  ): Headers {
    const headers = new Headers({
      Accept: 'application/json',
      'Content-Type': 'application/json',
    });

    requestHeadersArg?.forEach((value, key) => {
      headers.append(key, value);
    });

    if (cardinality === 'one') {
      headers.set('Accept', 'application/vnd.pgrst.object+json');
    }

    if (count) {
      headers.append('Prefer', `count=${count}`);
    }

    if (returning) {
      headers.append('Prefer', `return=${returning}`);
    }

    if (resolution) {
      headers.append('Prefer', `resolution=${resolution}`);
    }

    if (missing) {
      headers.append('Prefer', `missing=${missing}`);
    }

    return headers;
  }

  #fromAxiosHeaders(headers: object): Headers {
    const headersInit = Object.fromEntries(Object.entries(headers));
    return new Headers(headersInit);
  }

  /**
   * A helper private method combining logic for POST, PATCH and PUT methods.
   */
  async #mutate<
    Q extends Query<DB, keyof DB>,
    Method extends Extract<HttpMethod, 'POST' | 'PATCH' | 'PUT'>,
  >({
    method,
    query,
    data: requestData,
    headers: requestHeadersArg,
  }: {
    method: Method;
    query: Q;
    data: unknown;
    headers?: Headers;
  }) {
    const queryObj = query.toObject();
    const { tableName, cardinality, returning } = queryObj;
    const url = this.#getRequestUrl(tableName, query);
    const requestHeaders = this.#getRequestHeaders(queryObj, requestHeadersArg);

    if (this.#axiosInstance) {
      try {
        const {
          data,
          headers: axiosResponseHeaders,
          status,
          statusText,
        } = await this.#axiosInstance[
          method.toLowerCase() as Lowercase<Method>
        ](url, requestData, {
          headers: Object.fromEntries(requestHeaders),
        });

        const headers = this.#fromAxiosHeaders(axiosResponseHeaders);
        const response = this.#transformResponse({
          data,
          headers,
          cardinality,
          // NOTE: Axios throws an error instead of returning `ok: boolean`
          ok: true,
          queryObj,
        });

        if (returning === 'representation') {
          this.#validateResponseCardinality({
            data,
            queryObj: query.toObject(),
          });
        }

        return {
          ...response,
          headers,
          data: response.rows,
          status,
          statusText,
        };
      } catch (err) {
        if (isAxiosError(err)) {
          if (err.response) {
            const {
              status,
              statusText,
              data,
              headers: axiosResponseHeaders,
            } = err.response;
            const headers = this.#fromAxiosHeaders(axiosResponseHeaders);
            throw new PostgrestError(
              status,
              statusText,
              data as PostgrestErrorResponseData,
              headers,
            );
          } else {
            throw new Error('Axios request failed');
          }
        }

        throw err;
      }
    }

    const fetchResponse = await fetch(url, {
      method,
      headers: requestHeaders,
      body: JSON.stringify(requestData),
    });
    const { headers, status, statusText, ok } = fetchResponse;
    const hasData =
      headers.get('Content-Type')?.includes('application/json') ||
      headers
        .get('Content-Type')
        ?.includes('application/vnd.pgrst.object+json');
    const data = hasData ? await fetchResponse.json() : undefined;

    if (!ok) {
      throw new PostgrestError(status, statusText, data, headers);
    }

    if (returning === 'representation') {
      this.#validateResponseCardinality({ data, queryObj: query.toObject() });
    }

    const response = this.#transformResponse({
      data,
      headers,
      cardinality,
      ok,
      queryObj,
    });

    return {
      ...response,
      headers,
      status,
      statusText,
    };
  }

  /**
   * Fetch data using HTTP GET request.
   *
   * @param param0 Object with query property - e.g. `{ query }`.
   * @returns Promise with mandatory `status`, `statusText` and `headers` properties
   * and optional properties based on `count` header (query `.count()` method).
   * Either `row` or `rows` property depending on the cardinality
   * (default to array, and it can be changed with `query.single()`).
   * @example
   * ```ts
   * const query = pgClient.query('my_name');
   * const { status, statusText, headers, rows } = await pgClient.get({ query });
   * ```
   * @example
   * ```ts
   * const query = pgClient.query('my_name').count('exact');
   * const {
   *   status,
   *   statusText,
   *   headers,
   *   rows,
   *   totalLength,
   *   pagesLength,
   * } = await pgClient.get({ query });
   * ```
   * @example
   * ```ts
   * const query = pgClient.query('my_name').eq('id', 1).single();
   * const { status, statusText, headers, row } = await pgClient.delete({ query });
   * ```
   */
  async get<Q extends Query<DB, keyof DB>>({
    query,
    headers: requestHeadersArg,
  }: {
    query: Q;
    headers?: Headers;
  }): Promise<QueryResponseGet<Q>> {
    const queryObj = query.toObject();
    const { tableName, cardinality } = queryObj;
    const url = this.#getRequestUrl(tableName, query);
    const requestHeaders = this.#getRequestHeaders(queryObj, requestHeadersArg);

    if (this.#axiosInstance) {
      try {
        const {
          data,
          headers: axiosResponseHeaders,
          status,
          statusText,
        } = await this.#axiosInstance.get(url, {
          headers: Object.fromEntries(requestHeaders),
        });

        const headers = this.#fromAxiosHeaders(axiosResponseHeaders);
        const response = this.#transformResponse({
          data,
          headers,
          cardinality,
          // NOTE: Axios throws an error instead of returning `ok: boolean`
          ok: true,
          queryObj,
        });

        this.#validateResponseCardinality({ data, queryObj: query.toObject() });

        return {
          ...response,
          headers,
          data: response.rows,
          status,
          statusText,
        };
      } catch (err) {
        if (isAxiosError(err)) {
          if (err.response) {
            const {
              status,
              statusText,
              data,
              headers: axiosResponseHeaders,
            } = err.response;
            const headers = this.#fromAxiosHeaders(axiosResponseHeaders);
            throw new PostgrestError(
              status,
              statusText,
              data as PostgrestErrorResponseData,
              headers,
            );
          } else {
            throw new Error('Axios request failed');
          }
        }

        throw err;
      }
    }

    const fetchResponse = await fetch(url, { headers: requestHeaders });
    const data = await fetchResponse.json();
    const { headers, status, statusText, ok } = fetchResponse;
    const response = this.#transformResponse({
      data,
      headers,
      cardinality,
      ok,
      queryObj,
    });

    if (!ok) {
      throw new PostgrestError(status, statusText, data, headers);
    }

    this.#validateResponseCardinality({ data, queryObj: query.toObject() });

    return {
      ...response,
      data: response.rows || response,
      headers,
      status,
      statusText,
    };
  }

  /**
   * The same as GET request, but without actual table rows.
   *
   * @param param0 Object with query property - e.g. `{ query }`.
   * @returns Promise with mandatory `status`, `statusText` and `headers` properties
   * and optional properties based on `count` header (query `.count()` method).
   * @example
   * ```ts
   * const query = pgClient.query('my_name');
   * const { status, statusText, headers } = await pgClient.head({ query });
   * ```
   * @example
   * ```ts
   * const query = pgClient.query('my_name').count('exact');
   * const {
   *   status,
   *   statusText,
   *   headers,
   *   totalLength,
   *   pagesLength,
   * } = await pgClient.head({ query });
   * ```
   */
  async head<Q extends Query<DB, keyof DB>>({
    query,
    headers: requestHeadersArg,
  }: {
    query: Q;
    headers?: Headers;
  }): Promise<
    CountMetadata<'HEAD', Q> & {
      headers: Headers;
      status: number;
      statusText: string;
    }
  > {
    const queryObj = query.toObject();
    const { tableName } = queryObj;
    const url = this.#getRequestUrl(tableName, query);
    const requestHeaders = this.#getRequestHeaders(queryObj, requestHeadersArg);

    if (this.#axiosInstance) {
      try {
        const {
          headers: axiosResponseHeaders,
          status,
          statusText,
        } = await this.#axiosInstance.head(url, {
          headers: Object.fromEntries(requestHeaders),
        });

        const headers = this.#fromAxiosHeaders(axiosResponseHeaders);

        return {
          ...this.#getCountMetadata<'HEAD', Q>(headers, queryObj.limit),
          headers,
          status,
          statusText,
        };
      } catch (err) {
        if (isAxiosError(err)) {
          if (err.response) {
            const {
              status,
              statusText,
              headers: axiosResponseHeaders,
            } = err.response;
            const headers = this.#fromAxiosHeaders(axiosResponseHeaders);
            throw new PostgrestError(status, statusText, null, headers);
          } else {
            throw new Error('Axios request failed');
          }
        }

        throw err;
      }
    }

    const { headers, status, statusText, ok } = await fetch(url, {
      method: 'HEAD',
      headers: requestHeaders,
    });

    if (!ok) {
      throw new PostgrestError(status, statusText, null, headers);
    }

    return {
      ...this.#getCountMetadata<'HEAD', Q>(headers, queryObj.limit),
      headers,
      status,
      statusText,
    };
  }

  /**
   * Insert new rows using HTTP POST method with support for upsert.
   *
   * @param param0 Object with query property - e.g. `{ query, data }`.
   * `data` can be a single row or an array of rows.
   * @returns Promise with mandatory `status`, `statusText` and `headers` properties
   * and optional properties based on `count` header (`query.count()` method).
   * It can also return `row` or `rows` property depending on the cardinality
   * (default to array, and it can be changed with `query.single()`)
   * when `query.returning('representation')` is called.
   * @example
   * ```ts
   * const query = pgClient.query('my_name');
   * const { status, statusText, headers, rows } = await pgClient.post({
   *   query,
   *   data: [
   *     { my_column: 'some value', another_column: 1 },
   *     { my_column: 'another value', another_column: 2 },
   *   ]
   * });
   * ```
   * @example
   * ```ts
   * const query = pgClient
   *   .query('my_name')
   *   .returning('representation')
   *   .select('my_column');
   * const {
   *   status,
   *   statusText,
   *   headers,
   *   rows,
   * } = await pgClient.post({
   *   query,
   *   data: { my_column: 'some value', another_column: 1 }
   * });
   * ```
   * @example
   * ```ts
   * const query = pgClient
   *   .query('my_name')
   *   .onConflict('ignore-duplicates', 'my_column')
   *   .returning('representation')
   *   .single();
   * const { status, statusText, headers, row } = await pgClient.post({
   *   query,
   *   data: { my_column: 'some value', another_column: 1 }
   * });
   * ```
   */
  async post<Q extends Query<DB, keyof DB>>({
    query,
    data,
    headers,
  }: {
    query: Q;
    data: PostRequestData<Q>;
    headers?: Headers;
  }): Promise<QueryResponsePost<Q>> {
    return this.#mutate({ method: 'POST', query, data, headers });
  }

  /**
   * Update (modify) single or multiple rows using HTTP PATCH method.
   *
   * @param param0 Object with query property - e.g. `{ query, data }`.
   * `data` is a single row (object).
   * @returns Promise with mandatory `status`, `statusText` and `headers` properties
   * and optional properties based on `count` header (`query.count()` method).
   * It can also return `row` or `rows` property depending on the cardinality
   * (default to array, and it can be changed with `query.single()`)
   * when `query.returning('representation')` is called.
   * @example
   * ```ts
   * const query = pgClient.query('my_name').eq('id', 5);
   * const { status, statusText, headers } = await pgClient.patch({
   *   query,
   *   data: { my_column: 'some value' }
   * });
   * ```
   * @example
   * ```ts
   * const query = pgClient
   *   .query('my_name')
   *   .eq('id', 5)
   *   .returning('representation')
   *   .single();
   * const { status, statusText, headers, row } = await pgClient.patch({
   *   query,
   *   data: { my_column: 'some value' }
   * });
   * ```
   * @example
   * ```ts
   * const query = pgClient.query('my_name').gt('id', 5).returning('representation');
   * const { status, statusText, headers, rows } = await pgClient.patch({
   *   query,
   *   data: { my_column: 'some value' }
   * });
   * ```
   */
  async patch<Q extends Query<DB, keyof DB>>({
    query,
    data,
    headers,
  }: {
    query: Q;
    data: PatchRequestData<Q>;
    headers?: Headers;
  }): Promise<QueryResponsePatch<Q>> {
    return this.#mutate({ method: 'PATCH', query, data, headers });
  }

  /**
   * Single row upsert using HTTP PATCH method.
   *
   * @param param0 Object with query property - e.g. `{ query, data }`.
   * `data` is a single row (object).
   * It can also return `row` or `rows` property depending on the cardinality
   * (default to array, and it can be changed with `query.single()`)
   * when `query.returning('representation')` is called.
   * @returns Promise with `status`, `statusText` and `headers` properties.
   * @example
   * ```ts
   * const query = pgClient.query('my_name').eq('id', 5);
   * const { status, statusText, headers } = await pgClient.put({
   *   query,
   *   data: { my_column: 'some value' }
   * });
   * ```
   * @example
   * ```ts
   * const query = pgClient
   *   .query('my_name')
   *   .eq('id', 5)
   *   .returning('representation')
   *   .single();
   * const { status, statusText, headers, row } = await pgClient.put({
   *   query,
   *   data: { my_column: 'some value' }
   * });
   * ```
   */
  async put<Q extends Query<DB, keyof DB>>({
    query,
    data,
    headers,
  }: {
    query: Q;
    data: PutRequestData<Q>;
    headers?: Headers;
  }): Promise<QueryResponsePut<Q>> {
    return this.#mutate({ method: 'PUT', query, data, headers });
  }

  /**
   * Sends a HTTP DELETE request.
   *
   * @param param0 Object with query property - e.g. `{ query }`.
   * @returns Promise with mandatory `status`, `statusText` and `headers` properties
   * and optional properties based on `count` header (`query.count()` method).
   * @example
   * ```ts
   * const query = pgClient.query('my_name').eq('id', 1);
   * const { status, statusText, headers } = await pgClient.delete({ query });
   * ```
   * @example
   * ```ts
   * const query = pgClient.query('my_name').eq('id', 1).count('exact');
   * const { status, statusText, headers, totalLength } = await pgClient.delete({ query });
   * ```
   */
  async delete<Q extends Query<DB, keyof DB>>({
    query,
    headers: requestHeadersArg,
  }: {
    query: Q;
    headers?: Headers;
  }): Promise<QueryResponseDelete<Q>> {
    const queryObj = query.toObject();
    const { tableName, cardinality, returning } = queryObj;
    const url = this.#getRequestUrl(tableName, query);
    const requestHeaders = this.#getRequestHeaders(queryObj, requestHeadersArg);

    if (this.#axiosInstance) {
      try {
        const {
          headers: axiosResponseHeaders,
          status,
          statusText,
          data,
        } = await this.#axiosInstance.delete(url, {
          headers: Object.fromEntries(requestHeaders),
        });

        const headers = this.#fromAxiosHeaders(axiosResponseHeaders);

        if (returning === 'representation') {
          this.#validateResponseCardinality({
            data,
            queryObj: query.toObject(),
          });
        }

        const response = this.#transformResponse({
          data,
          headers,
          cardinality,
          // NOTE: Axios throws an error instead of returning `ok: boolean`
          ok: true,
          queryObj,
        });

        return {
          ...response,
          headers,
          status,
          statusText,
        };
      } catch (err) {
        if (isAxiosError(err)) {
          if (err.response) {
            const {
              status,
              statusText,
              headers: axiosResponseHeaders,
            } = err.response;
            const headers = this.#fromAxiosHeaders(axiosResponseHeaders);
            throw new PostgrestError(status, statusText, null, headers);
          } else {
            throw new Error('Axios request failed');
          }
        }

        throw err;
      }
    }

    const fetchResponse = await fetch(url, {
      method: 'DELETE',
      headers: requestHeaders,
    });
    const { headers, status, statusText, ok } = fetchResponse;
    const hasData =
      headers.get('Content-Type')?.includes('application/json') ||
      headers
        .get('Content-Type')
        ?.includes('application/vnd.pgrst.object+json');
    const data = hasData ? await fetchResponse.json() : undefined;
    const response = this.#transformResponse({
      data,
      headers,
      cardinality,
      ok,
      queryObj,
    });

    if (!ok) {
      throw new PostgrestError(status, statusText, null, headers);
    }

    if (returning === 'representation') {
      this.#validateResponseCardinality({ data, queryObj: query.toObject() });
    }

    return {
      ...response,
      headers,
      status,
      statusText,
    };
  }
}

/**
 *
 * @param config The same config object as accepted by PostgrestClient constructor.
 * @returns instance of PostgrestClient class
 */
export const createClient = <DB extends BaseDB>(
  config: PostgrestClientConfig,
) => new PostgrestClient<DB>(config);
