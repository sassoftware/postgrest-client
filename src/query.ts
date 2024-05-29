/*
Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/

import {
  BaseDB,
  Cardinality,
  Count,
  ConflictResolution,
  Returning,
  VerticalFilterSelector,
  VerticalFilterReturn,
  Headers,
  HeaderModifiers,
  VerticalFilterCastModifier,
  VerticalFilterNameModifier,
  JsonColumnFilter,
  VerticalJsonFilterReturn,
  CompositeFilter,
  CompositeStringFilter,
  CompositeColumnFilter,
  VerticalColumnFilter,
  TypeModifiers,
} from './types';

/**
 * An alias meaning a filter or a logical operator should be negated
 */
type IsNegated = boolean;

/**
 * @returns [column name, column value, negation]
 */
type FilterItemTuple<
  DB extends BaseDB,
  TableName extends keyof DB,
  Column extends keyof DB[TableName]['get'],
> = [Column, string | number, IsNegated];

/**
 * @returns [column name, column values array, negation]
 */
type FilterItemTupleArray<
  DB extends BaseDB,
  TableName extends keyof DB,
  Column extends keyof DB[TableName]['get'],
> = [Column, (string | number)[], IsNegated];

type Order<DB extends BaseDB, TableName extends keyof DB> = {
  column: GetMethodColumn<DB, TableName>;
  order?: 'asc' | 'desc';
  nulls?: 'first' | 'last';
};

type QueryData<DB extends BaseDB, TableName extends keyof DB> = {
  tableName: Extract<TableName, string>;
  cardinality: Cardinality;
  onConflict?: GetMethodColumn<DB, keyof DB>;
  missing?: 'default';
  select: VerticalFilterSelector<DB, keyof DB>[];
  eq: FilterItemTuple<DB, keyof DB, GetMethodColumn<DB, keyof DB>>[];
  gt: FilterItemTuple<DB, keyof DB, GetMethodColumn<DB, keyof DB>>[];
  gte: FilterItemTuple<DB, keyof DB, GetMethodColumn<DB, keyof DB>>[];
  lt: FilterItemTuple<DB, keyof DB, GetMethodColumn<DB, keyof DB>>[];
  lte: FilterItemTuple<DB, keyof DB, GetMethodColumn<DB, keyof DB>>[];
  neq: FilterItemTuple<DB, keyof DB, GetMethodColumn<DB, keyof DB>>[];
  like: FilterItemTuple<DB, keyof DB, GetMethodColumn<DB, keyof DB>>[];
  ilike: FilterItemTuple<DB, keyof DB, GetMethodColumn<DB, keyof DB>>[];
  in: FilterItemTupleArray<DB, keyof DB, GetMethodColumn<DB, keyof DB>>[];
  is: [GetMethodColumn<DB, keyof DB>, null | true | false, IsNegated][];
  and: [Query<DB, keyof DB>[], IsNegated][];
  or: [Query<DB, keyof DB>[], IsNegated][];
  not: IsNegated;
  order: Order<DB, keyof DB>[];
  offset: number;
  limit?: number;
  columns: GetMethodColumn<DB, keyof DB>[];
  inner: boolean;
} & Headers;

export type QueryDataObject<
  DB extends BaseDB,
  TableName extends keyof DB,
> = Omit<QueryData<DB, TableName>, 'and' | 'or' | 'select' | 'not'> & {
  and: [QueryDataObject<DB, keyof DB>[], IsNegated][];
  or: [QueryDataObject<DB, keyof DB>[], IsNegated][];
  select: (
    | string
    | QueryDataObject<DB, keyof DB>
    | {
        column: string;
        modifier: VerticalFilterNameModifier & VerticalFilterCastModifier;
      }
    | {
        query: QueryDataObject<DB, keyof DB>;
        modifier: VerticalFilterNameModifier;
      }
  )[];
};

type QueryProps<DB extends BaseDB, TableName extends keyof DB> = Pick<
  QueryData<DB, TableName>,
  'tableName'
> &
  Partial<Omit<QueryData<DB, TableName>, 'tableName'>>;

/**
 * Utility type returning column name as a string
 */
type GetMethodColumn<DB extends BaseDB, TableName extends keyof DB> =
  | Extract<keyof DB[TableName]['get'], string>
  | CompositeFilter<DB, TableName>
  | CompositeStringFilter<DB, TableName>;

type HorizontalFilterValue<
  DB extends BaseDB,
  TableName extends keyof DB,
  Column extends GetMethodColumn<DB, TableName>,
> =
  Column extends VerticalColumnFilter<DB, TableName>
    ? NonNullable<DB[TableName]['get'][Column]>
    : Column extends CompositeStringFilter<DB, TableName>
      ? string
      : Column extends CompositeColumnFilter<DB, TableName>
        ? never
        : Column extends CompositeFilter<DB, TableName>
          ? string | number
          : never;

// NOTE: exported only for tests
export const HORIZONTAL_FILTERS = [
  'eq',
  'gt',
  'gte',
  'lt',
  'lte',
  'neq',
  'like',
  'ilike',
  'in',
  'is',
] as const;

export class Query<
  DB extends BaseDB,
  const TableName extends keyof DB,
  C extends Cardinality = 'many',
  /**
   * Return type
   */
  R extends object | '*' | null = null,
  /**
   * Headers
   */
  H extends HeaderModifiers = object,
  /**
   * Embedded query return type modifiers
   * * nullable used for "to-one" cardinality
   */
  M extends TypeModifiers = { nullable: false },
> {
  readonly #props: QueryData<DB, TableName>;

  constructor(props: QueryProps<DB, TableName>) {
    this.#props = Object.freeze({
      cardinality: 'many',
      select: [],
      eq: [],
      gt: [],
      gte: [],
      lt: [],
      lte: [],
      neq: [],
      like: [],
      ilike: [],
      in: [],
      is: [],
      and: [],
      or: [],
      not: false,
      order: [],
      offset: 0,
      columns: [],
      inner: false,
      ...props,
    });
  }

  #clone(
    props: Partial<QueryData<DB, TableName>> = {},
  ): Query<DB, TableName, C, R, H, M> {
    return new Query({
      ...this.#props,
      ...props,
      not: props.not ?? false,
    });
  }

  /**
   * Change resource representation.
   * By default PostgREST returns an array of objects (plural).
   *
   * This changes the response to singular,
   * meaning it returns a single object.
   *
   * Calling this method adds `vnd.pgrst.object` to the `Accept` header.
   *
   * @see https://postgrest.org/en/stable/references/api/resource_representation.html#singular-or-plural
   *
   * @returns a new immutable instance of the query with different representation.
   */
  single(): Query<DB, TableName, 'one', R, H> {
    return this.#clone({ cardinality: 'one' });
  }

  /**
   * Sets boolean value marking this as a top level filter.
   * And adds `!inner` to the query constructed.
   *
   * This is used only in embedded queries and will throw an error otherwise.
   *
   * @see https://postgrest.org/en/v12/references/api/resource_embedding.html#top-level-filtering
   *
   * @returns a new immutable instance of the query with inner set.
   */
  inner() {
    return this.#clone({ inner: true });
  }

  /**
   * Sets `Prefer: count=` value to obtain table size.
   *
   * @param count Count type. Can be `'exact'`, `'planned'` or `'estimated'`
   * @returns a new immutable instance of the query with added count header.
   */
  count<const CT extends Count>(
    count: CT,
  ): Query<DB, TableName, C, R, Omit<H, 'count'> & { count: CT }> {
    return this.#clone({ count });
  }

  /**
   * Specify if an object should be returned upon insertion.
   * Sets `Prefer: return=` value
   *
   * @param returning Return header value - `'minimal'`, `'headers-only'` or `'representation'`
   * @returns a new immutable instance of the query with added returning header.
   */
  returning<const Ret extends Returning>(
    returning: Ret,
  ): Query<DB, TableName, C, R, Omit<H, 'returning'> & { returning: Ret }> {
    return this.#clone({ returning });
  }

  /**
   * Upsert duplicates configuration.
   * Sets `Prefer: resolution=` value, as well as `on_conflict` query parameter.
   *
   * @param resolution Resolution header value - `'ignore-duplicates'` or `'merge-duplicates'`
   * @param column `on_conflict` query parameter
   * @returns a new immutable instance of the query with added conflict resolution parameters.
   */
  onConflict(
    resolution: ConflictResolution,
    column?: GetMethodColumn<DB, TableName>,
  ) {
    return this.#clone({ onConflict: column, resolution });
  }

  /**
   * Adds `Prefer: missing=` header.
   * Useful for inserts (`post` requests) when default value
   * should be inserted instead of `null`.
   *
   * @see https://postgrest.org/en/stable/references/api/tables_views.html#bulk-insert-with-default-values
   *
   * @param value Sets which value to use for missing values.
   * Currently supports "default" only.
   *
   * @returns a new immutable instance of the query with added missing header.
   */
  missing(value: 'default') {
    return this.#clone({ missing: value });
  }

  /**
   * Change schema. If this is not specified, default schema is used.
   *
   * @param schema Schema name
   * @returns a new immutable instance of the query with changed schema header.
   */
  schema(schema: string) {
    return this.#clone({ schema });
  }

  /**
   * Select columns or embed tables (vertical filter).
   *
   * @param selector column, another query instance with support for modifiers
   * @example
   * ```ts
   * 'id'
   * // or
   * ['id', { cast: 'number', name: 'renamedId' }]
   * // or
   * ['id', 'another']
   * // or
   * ['id', ['another', { cast: 'number', name: 'renamedAnother' }]]
   * // or
   * query2.select('table2_column')
   * // or
   * [query2.select('table2_column'), { name: 'renamedTable' }]
   * // or
   * ['id', query2.select('table2_column')]
   * // or
   * ['id', [query2.select('table2_column'), { name: 'renamedTable' }]]
   * ```
   * @returns a new immutable instance of the query with added select parameter.
   */
  select<
    const Selector extends
      | VerticalFilterSelector<DB, TableName>
      | ReadonlyArray<VerticalFilterSelector<DB, TableName>>,
  >(
    selector: Selector,
  ): VerticalFilterReturn<DB, TableName, C, R, H, M, Selector> {
    // modifiers are objects like `{ name, cast }` used for renaming or casting.
    const isModifier =
      Array.isArray(selector) &&
      typeof selector?.[1] === 'object' &&
      ('name' in selector[1] || 'cast' in selector[1]);

    const toAdd =
      Array.isArray(selector) && !isModifier
        ? selector
        : [selector as VerticalFilterSelector<DB, TableName>];

    return this.#clone({
      select: Array.from(new Set([...this.#props.select, ...toAdd])),
    });
  }

  selectJson<
    TypeExtender extends Record<string, unknown>,
    Selector extends
      | JsonColumnFilter<DB, TableName>
      | ReadonlyArray<JsonColumnFilter<DB, TableName>> =
      | JsonColumnFilter<DB, TableName>
      | ReadonlyArray<JsonColumnFilter<DB, TableName>>,
  >(
    selector: Selector,
  ): VerticalJsonFilterReturn<DB, TableName, C, R, H, TypeExtender> {
    return this.select(selector);
  }

  /**
   * Equality horizontal filter (`eq` - `=`).
   *
   * @param column Table column name
   * @param value Value to search by
   * @returns a new immutable instance of the query with added equality parameter
   * @see https://postgrest.org/en/stable/references/api/tables_views.html#horizontal-filtering
   */
  eq<Column extends GetMethodColumn<DB, TableName>>(
    column: Column,
    value: HorizontalFilterValue<DB, TableName, Column>,
  ) {
    return this.#clone({
      eq: [...this.#props.eq, [column, value, this.#props.not]],
    });
  }

  /**
   * Greater than filter (`gt` - `>`).
   *
   * @param column Table column name
   * @param value Value to search by
   * @returns a new immutable instance of the query with added equality parameter
   * @see https://postgrest.org/en/stable/references/api/tables_views.html#horizontal-filtering
   */
  gt<Column extends GetMethodColumn<DB, TableName>>(
    column: Column,
    value: HorizontalFilterValue<DB, TableName, Column>,
  ) {
    return this.#clone({
      gt: [...this.#props.gt, [column, value, this.#props.not]],
    });
  }

  /**
   * Greater than or equal filter (`gte` - `>=`).
   *
   * @param column Table column name
   * @param value Value to search by
   * @returns a new immutable instance of the query with added equality parameter
   * @see https://postgrest.org/en/stable/references/api/tables_views.html#horizontal-filtering
   */
  gte<Column extends GetMethodColumn<DB, TableName>>(
    column: Column,
    value: HorizontalFilterValue<DB, TableName, Column>,
  ) {
    return this.#clone({
      gte: [...this.#props.gte, [column, value, this.#props.not]],
    });
  }

  /**
   * Less than filter (`lt` - `<`).
   *
   * @param column Table column name
   * @param value Value to search by
   * @returns a new immutable instance of the query with added equality parameter
   * @see https://postgrest.org/en/stable/references/api/tables_views.html#horizontal-filtering
   */
  lt<Column extends GetMethodColumn<DB, TableName>>(
    column: Column,
    value: HorizontalFilterValue<DB, TableName, Column>,
  ) {
    return this.#clone({
      lt: [...this.#props.lt, [column, value, this.#props.not]],
    });
  }

  /**
   * Less than or equal filter (`lte` - `<=`).
   *
   * @param column Table column name
   * @param value Value to search by
   * @returns a new immutable instance of the query with added equality parameter
   * @see https://postgrest.org/en/stable/references/api/tables_views.html#horizontal-filtering
   */
  lte<Column extends GetMethodColumn<DB, TableName>>(
    column: Column,
    value: HorizontalFilterValue<DB, TableName, Column>,
  ) {
    return this.#clone({
      lte: [...this.#props.lte, [column, value, this.#props.not]],
    });
  }

  /**
   * Not equal filter (`neq` - `!=` or `<>`).
   *
   * @param column Table column name
   * @param value Value to search by
   * @returns a new immutable instance of the query with added equality parameter
   * @see https://postgrest.org/en/stable/references/api/tables_views.html#horizontal-filtering
   */
  neq<Column extends GetMethodColumn<DB, TableName>>(
    column: Column,
    value: HorizontalFilterValue<DB, TableName, Column>,
  ) {
    return this.#clone({
      neq: [...this.#props.neq, [column, value, this.#props.not]],
    });
  }

  /**
   * Like filter (`like` - `LIKE`).
   *
   * @param column Table column name
   * @param value Value to search by
   * @returns a new immutable instance of the query with added equality parameter
   * @see https://postgrest.org/en/stable/references/api/tables_views.html#horizontal-filtering
   */
  like<Column extends GetMethodColumn<DB, TableName>>(
    column: Column,
    value: HorizontalFilterValue<DB, TableName, Column>,
  ) {
    return this.#clone({
      like: [...this.#props.like, [column, value, this.#props.not]],
    });
  }

  /**
   * Case insensitive like filter (`ilike` - `ILIKE`).
   *
   * @param column Table column name
   * @param value Value to search by
   * @returns a new immutable instance of the query with added equality parameter
   * @see https://postgrest.org/en/stable/references/api/tables_views.html#horizontal-filtering
   */
  ilike<Column extends GetMethodColumn<DB, TableName>>(
    column: Column,
    value: HorizontalFilterValue<DB, TableName, Column>,
  ) {
    return this.#clone({
      ilike: [...this.#props.ilike, [column, value, this.#props.not]],
    });
  }

  /**
   * In filter (`in` - `IN`).
   *
   * @param column Table column name
   * @param value Value to search by
   * @returns a new immutable instance of the query with added equality parameter
   * @see https://postgrest.org/en/stable/references/api/tables_views.html#horizontal-filtering
   */
  in<Column extends GetMethodColumn<DB, TableName>>(
    column: Column,
    value: HorizontalFilterValue<DB, TableName, Column>[],
  ) {
    return this.#clone({
      in: [...this.#props.in, [column, value, this.#props.not]],
    });
  }

  /**
   * In filter (`is` - `IS`).
   *
   * @param column Table column name
   * @param value Value to search by
   * @returns a new immutable instance of the query with added equality parameter
   * @see https://postgrest.org/en/stable/references/api/tables_views.html#horizontal-filtering
   */
  is<Column extends GetMethodColumn<DB, TableName>>(
    column: Column,
    value: null | true | false,
  ) {
    return this.#clone({
      is: [...this.#props.is, [column, value, this.#props.not]],
    });
  }

  /**
   * Logical operator `and`
   *
   * @param queries an array of queries
   * @returns an array of modified query copies
   */
  and(queries: Query<DB, TableName>[]): Query<DB, TableName, C, R, H, M>;
  /**
   * Logical operator `and`
   *
   * @param queryFn query function with current query as a parameter
   * returning an array of queries
   * @returns an array of modified query copies
   */
  and(
    queryFn: (query: Query<DB, TableName>) => Query<DB, TableName>[],
  ): Query<DB, TableName, C, R, H, M>;
  and(
    q:
      | ((query: Query<DB, TableName>) => Query<DB, TableName>[])
      | Query<DB, TableName>[],
  ) {
    if (typeof q === 'function') {
      return this.#clone({
        and: [
          ...this.#props.and,
          [
            q(new Query({ tableName: this.#props.tableName })) as Query<
              DB,
              keyof DB
            >[],
            this.#props.not,
          ],
        ],
      });
    }

    return this.#clone({
      and: [...this.#props.and, [q as Query<DB, keyof DB>[], this.#props.not]],
    });
  }

  /**
   * Logical operator `or`
   *
   * @param queries an array of queries
   * @returns an array of modified query copies
   */
  or(queries: Query<DB, TableName>[]): Query<DB, TableName, C, R, H, M>;
  /**
   * Logical operator `or`
   *
   * @param queryFn query function with current query as a parameter
   * returning an array of queries
   * @returns an array of modified query copies
   */
  or(
    queryFn: (query: Query<DB, TableName>) => Query<DB, TableName>[],
  ): Query<DB, TableName, C, R, H, M>;
  or(
    q:
      | ((query: Query<DB, TableName>) => Query<DB, TableName>[])
      | Query<DB, TableName>[],
  ) {
    if (typeof q === 'function') {
      return this.#clone({
        or: [
          ...this.#props.or,
          [
            q(new Query({ tableName: this.#props.tableName })) as Query<
              DB,
              keyof DB
            >[],
            this.#props.not,
          ],
        ],
      });
    }

    return this.#clone({
      or: [...this.#props.or, [q as Query<DB, keyof DB>[], this.#props.not]],
    });
  }

  /**
   * Logical operator `not`
   *
   * @example
   * query.not.eq('id',1)
   */
  get not() {
    return this.#clone({ not: true });
  }

  /**
   * A utility method to return everything needed to construct a query.
   * This could be useful for storing a query as a string for example,
   * or for creating a unique key from the returned object
   *
   * @returns a serializable object with all query parameters and headers.
   */
  toObject(): QueryDataObject<DB, TableName> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { not, ...objProps } = this.#props;

    return {
      ...objProps,
      and: this.#props.and.map(([queries, not]) => [
        queries.map((q) => q.toObject()),
        not,
      ]),
      or: this.#props.or.map(([queries, not]) => [
        queries.map((q) => q.toObject()),
        not,
      ]),
      select: this.#props.select.map((selectItem) => {
        if (typeof selectItem === 'string') {
          return selectItem;
        } else if (selectItem instanceof Query) {
          return selectItem.toObject();
        } else if (
          Array.isArray(selectItem) &&
          selectItem.length === 2 &&
          typeof selectItem[0] === 'string' &&
          (selectItem[1].name || selectItem[1].cast)
        ) {
          return { column: selectItem[0], modifier: selectItem[1] };
        } else if (
          Array.isArray(selectItem) &&
          selectItem.length === 2 &&
          selectItem[0] instanceof Query &&
          selectItem[1].name
        ) {
          return {
            query: selectItem[0].toObject() as QueryDataObject<DB, TableName>,
            modifier: selectItem[1],
          };
        }

        throw new Error(`Invalid select ${JSON.stringify(selectItem)}`);
      }),
    };
  }

  /**
   * Recursive function returning `select` query string.
   *
   * @param options config object with {isNested, name} structure
   * @example
   * ```ts
   * { isNested: true, name: 'anotherName' }
   * ```
   */
  #getSelectQueryString(options?: { isNested?: never; name?: never }): string;
  #getSelectQueryString(options?: { isNested: true; name?: string }): string;
  #getSelectQueryString({
    isNested,
    name,
  }: { isNested?: boolean; name?: string } = {}) {
    const selectStr = this.#props.select
      .map((selectItem) => {
        if (typeof selectItem === 'string') {
          return selectItem;
        } else if (selectItem instanceof Query) {
          return selectItem.#getSelectQueryString({ isNested: true });
        } else if (
          Array.isArray(selectItem) &&
          selectItem.length === 2 &&
          typeof selectItem[0] === 'string' &&
          (selectItem[1].name || selectItem[1].cast)
        ) {
          let selector = selectItem[1].name
            ? `${selectItem[1].name}:${selectItem[0]}`
            : selectItem[0];
          if (selectItem[1].cast) {
            selector += `::${selectItem[1].cast}`;
          }
          return selector;
        } else if (
          Array.isArray(selectItem) &&
          selectItem.length === 2 &&
          selectItem[0] instanceof Query &&
          selectItem[1].name
        ) {
          return selectItem[0].#getSelectQueryString({
            isNested: true,
            ...selectItem[1],
          });
        }

        throw new Error(`Invalid select ${JSON.stringify(selectItem)}`);
      })
      .join(',');

    if (isNested) {
      const renamePrefix = name ? `${name}:` : '';
      const inner = this.#props.inner ? `!inner` : '';
      return `${renamePrefix}${this.#props.tableName}${inner}(${selectStr})`;
    }

    if (this.#props.inner && !isNested) {
      throw new Error('.inner() can be used only on embedded queries');
    }

    return selectStr;
  }

  /**
   * Extracts horizontal filters from nested queries
   * with correct prefixes.
   *
   * @returns a key/value array where key is a filter key (`eq`, `is`, `gt`, etc.)
   * and value is an object with {column, filter, not} modifiers
   * @example
   * `['eq', { column: 'nestedTable.id', filter: 1, not: false }]`
   * or
   * `['in', { column: 'id', filter: [1, 2], not: true }]`
   */
  #getNestedHorizontalFilters() {
    const entries: {
      filterKey: string;
      column: string;
      filter: string | string[];
      not: boolean;
    }[] = [];

    this.#props.select.forEach((selectItem) => {
      if (selectItem instanceof Query) {
        const mappedEntries: typeof entries = selectItem
          .#getHorizontalFilters()
          .map(({ column, filterKey, ...rest }) => ({
            column: `${selectItem.#props.tableName}.${column}`,
            filterKey,
            ...rest,
          }));
        entries.push(...mappedEntries);
      } else if (Array.isArray(selectItem) && selectItem[0] instanceof Query) {
        const mappedEntries: typeof entries = selectItem[0]
          .#getHorizontalFilters()
          .map(({ column, filterKey, ...rest }) => ({
            column: `${selectItem[1].name}.${column}`,
            filterKey,
            ...rest,
          }));
        entries.push(...mappedEntries);
      }
    });

    return entries;
  }

  /**
   * Recursively gets all horizontal filters.
   *
   * @returns a key/value array where key is a filter key (`eq`, `is`, `gt`, etc.)
   * and value is an object with {column, filter, not} modifiers
   * @example
   * `['eq', { column: 'nestedTable.id', filter: 1, not: false }]`
   * or
   * `['in', { column: 'id', filter: [1, 2], not: true }]`
   */
  #getHorizontalFilters() {
    const entries: {
      filterKey: string;
      column: string;
      filter: string | string[];
      not: boolean;
    }[] = [];

    HORIZONTAL_FILTERS.forEach((filterKey) => {
      this.#props[filterKey].forEach(([column, filter, not]) => {
        entries.push({
          column,
          filterKey,
          filter: Array.isArray(filter) ? filter.map(String) : String(filter),
          not,
        });
      });
    });

    entries.push(...this.#getNestedHorizontalFilters());

    return entries;
  }

  /**
   * Helper function to get all values recursively for a primitive filter.
   * Primitive filter refers to a filter with
   * a primitive value (`number`, or `string` for example).
   *
   * @param filter filter name - currently supports only `limit` and `offset`
   * @returns array of key/value pairs
   * @example
   * ```ts
   * [['limit', 1], ['anotherTable.limit', 1]]
   * ```
   */
  #getPrimitiveFilterEntries(filter: 'limit' | 'offset') {
    const entries: [string, string][] = [];

    if (
      this.#props[filter] !== undefined &&
      // skip offset=0 because it doesn't have any effect
      // and that's default value
      !(filter === 'offset' && this.#props[filter] === 0)
    ) {
      entries.push([filter, this.#props[filter]!.toString()]);
    }

    this.#props.select.forEach((selectItem) => {
      if (selectItem instanceof Query) {
        selectItem.#getPrimitiveFilterEntries(filter).forEach(([key, val]) => {
          entries.push([`${selectItem.#props.tableName}.${key}`, val]);
        });
      } else if (Array.isArray(selectItem) && selectItem[0] instanceof Query) {
        selectItem[0]
          .#getPrimitiveFilterEntries(filter)
          .forEach(([key, val]) => {
            entries.push([`${selectItem[1].name}.${key}`, val]);
          });
      }
    });

    return entries;
  }

  /**
   * Recursive method to get all `order` filters.
   *
   * @returns array of key/value pairs
   * @example
   * ```ts
   * [['order', 'id.desc'], ['anotherTable.order', 'id']]
   * ```
   */
  #getOrderFilter() {
    const entries: [string, string][] = [];

    if (this.#props.order.length > 0) {
      entries.push([
        'order',
        this.#props.order
          .map(({ column, order, nulls }) => {
            let res = column as string;
            if (order) {
              res += `.${order}`;
            }
            if (nulls) {
              res += `.nulls${nulls}`;
            }
            return res;
          })
          .join(','),
      ]);
    }

    this.#props.select.forEach((selectItem) => {
      if (selectItem instanceof Query) {
        selectItem.#getOrderFilter().forEach(([key, val]) => {
          entries.push([`${selectItem.#props.tableName}.${key}`, val]);
        });
      } else if (Array.isArray(selectItem) && selectItem[0] instanceof Query) {
        selectItem[0].#getOrderFilter().forEach(([key, val]) => {
          entries.push([`${selectItem[1].name}.${key}`, val]);
        });
      }
    });

    return entries;
  }

  /**
   * Recursive method to get all logical filters.
   *
   * @returns array of key/value pairs
   * @example
   * ```ts
   * [
   *   ['and', '(id.eq.1,id.in.(2,5))'],
   *   ['anotherTable.not.and', '(id.eq.1,id.in.(2,5))']
   * ]
   * ```
   */
  #getLogicalFilters({ nested }: { nested?: true } = {}) {
    const entries: [string, string][] = [];

    (['and', 'or'] as const).forEach((logicalOperator) => {
      this.#props[logicalOperator].forEach(([queries, not]) => {
        const values = queries.map((query) => [
          ...query
            .#getHorizontalFilters()
            .map(
              ({ column, filterKey, filter, not }) =>
                `${column}.${
                  not ? 'not.' : ''
                }${filterKey}.${this.#sanitizeFilter(filter)}`,
            ),
          ...query.#getLogicalFilters({ nested: true }).map((q) => q.join('')),
        ]);
        entries.push([
          not ? `not.${logicalOperator}` : logicalOperator,
          `(${values})`,
        ]);
      });
    });

    if (!nested) {
      this.#props.select.forEach((selectItem) => {
        if (selectItem instanceof Query) {
          selectItem
            .#getLogicalFilters({ nested: true })
            .forEach(([key, val]) => {
              entries.push([`${selectItem.#props.tableName}.${key}`, val]);
            });
        } else if (
          Array.isArray(selectItem) &&
          selectItem[0] instanceof Query
        ) {
          selectItem[0]
            .#getLogicalFilters({ nested: true })
            .forEach(([key, val]) => {
              entries.push([`${selectItem[1].name}.${key}`, val]);
            });
        }
      });
    }

    return entries;
  }

  /**
   * Escapes quotes in filter strings and quotes them
   * in case of special characters.
   *
   * @see https://postgrest.org/en/stable/references/api/url_grammar.html?highlight=encode#reserved-characters
   *
   * @param filter filter string or array of strings
   *
   * @returns quoted and escaped filters
   */
  #sanitizeFilter(filter: string | string[]): string {
    const specialCharacters = [',', '.', ':', '(', ')', '"', ' '];
    const sanitizeItem = (item: string) =>
      specialCharacters.some((s) => item.includes(s))
        ? `"${item.replaceAll('"', '\\"')}"`
        : item;

    return Array.isArray(filter)
      ? `(${filter.map(sanitizeItem)})`
      : sanitizeItem(filter);
  }

  /**
   * Method for building a query string from query instance.
   *
   * @param options optional object `{ encoded?: boolean }`
   * @returns Query string (URL encoded by default).
   *
   * @throws {Error}
   * Throws when top level filtering for top level query (non-embedded) is detected.
   */
  toString({
    encoded = true,
  }: {
    /**
     * Query strings should be encoded, but for ease of debugging
     * developers might choose to disable this.
     */
    encoded?: boolean;
  } = {}): string {
    const urlSearchParams = new URLSearchParams();

    const selectStr = this.#getSelectQueryString();
    if (selectStr) {
      urlSearchParams.append('select', selectStr);
    }

    this.#getHorizontalFilters().forEach(
      ({ column, filterKey, filter, not }) => {
        if (Array.isArray(filter)) {
          urlSearchParams.append(
            column,
            `${not ? 'not.' : ''}${filterKey}.${this.#sanitizeFilter(filter)}`,
          );
        } else {
          urlSearchParams.append(
            column,
            `${not ? 'not.' : ''}${filterKey}.${filter}`,
          );
        }
      },
    );

    this.#getLogicalFilters().forEach(([key, value]) => {
      urlSearchParams.append(key, value);
    });

    this.#getOrderFilter().forEach(([key, value]) =>
      urlSearchParams.append(key, value),
    );

    this.#getPrimitiveFilterEntries('limit').forEach(([key, val]) =>
      urlSearchParams.append(key, val),
    );

    this.#getPrimitiveFilterEntries('offset').forEach(([key, val]) =>
      urlSearchParams.append(key, val),
    );

    if (this.#props.onConflict) {
      urlSearchParams.append('on_conflict', this.#props.onConflict);
    }

    if (this.#props.columns.length > 0) {
      urlSearchParams.append('columns', this.#props.columns.join(','));
    }

    return encoded
      ? urlSearchParams.toString()
      : decodeURIComponent(urlSearchParams.toString());
  }

  /**
   * Order parameter (`order`).
   *
   * @param order an array of objects with column name, ordering and nulls position.
   * @example
   * ```ts
   * query.order([
   *   { column: 'name', order; 'desc', nulls: 'first' },
   *   { column: 'id' },
   * ])
   * ```
   * @returns a new immutable instance of the query with added `order` parameter.
   */
  order(order: Order<DB, TableName>[]) {
    return this.#clone({
      order: [...this.#props.order, ...(order as Order<DB, keyof DB>[])],
    });
  }

  /**
   * Offset parameter (`offset`).
   *
   * @param offset number of rows to skip.
   * @returns a new immutable instance of the query with added `offset` parameter.
   */
  offset(offset: number) {
    return this.#clone({ offset });
  }

  /**
   * Limit parameter (`limit`).
   *
   * @param limit number of rows to fetch.
   * @returns a new immutable instance of the query with added `limit` parameter.
   */
  limit(limit: number) {
    return this.#clone({ limit });
  }

  /**
   * Alternative to `limit` and `order` combination
   *
   * @param page zero based page index
   * @param pageSize number of rows to fetch. The same as `limit`.
   * @returns a new immutable instance of the query with added `limit` and `offset` parameters.
   */
  page(page: number, pageSize: number = 10) {
    return this.#clone({
      offset: page * pageSize,
      limit: pageSize,
    });
  }

  /**
   * Sets which columns to insert and ignore others.
   *
   * @see https://postgrest.org/en/stable/references/api/tables_views.html#specifying-columns
   *
   *
   * @param columns Array of table column names
   * @returns a new immutable instance of the query with added `columns` parameter.
   */
  columns(columns: GetMethodColumn<DB, TableName>[]) {
    return this.#clone({ columns: [...this.#props.columns, ...columns] });
  }
}
