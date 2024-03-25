/*
Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/

/* eslint-disable @typescript-eslint/no-explicit-any */
import { UnionToIntersection } from 'type-fest';

import { Query } from './query';

type DeepSimplify<T> = {
  [Prop in keyof T]: T[Prop] extends Array<infer TT>
    ? Array<DeepSimplify<TT>>
    : T[Prop] extends object
      ? DeepSimplify<T[Prop]>
      : T[Prop];
} & NonNullable<unknown>;

// TODO: we might need to change this structure before initial release
// to make sure we can support 2 tables with the same name in 2 different schemas.
// Another solution is to let people define 2 instances of `PostgrestClient`.
// `const pgClientDefaultSchema = new PostgrestClient<DB>();`
// and `const pgClientAnotherSchema = new PostgrestClient<AnotherDB>({ schema: 'another' })`
export type BaseDB = Record<
  string,
  {
    // TODO: update table types with correct union
    get: Record<string, any>;
    post: Record<string, any>;
    put: Record<string, any>;
    patch: Record<string, any>;
  }
>;

export type Cardinality = 'one' | 'many';
export type Returning = 'minimal' | 'headers-only' | 'representation';
export type Count = 'exact' | 'planned' | 'estimated';
export type ConflictResolution = 'ignore-duplicates' | 'merge-duplicates';
export type HttpMethod = 'GET' | 'HEAD' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
export type TypeModifiers = { nullable: boolean };

type AutogeneratedOrNull<
  T extends object,
  AutoGeneratedColumns extends keyof T = never,
> =
  | AutoGeneratedColumns
  | { [P in keyof T]: null extends T[P] ? P : never }[keyof T];

export type PostgresTable<
  T extends object,
  /**
   * Columns with auto generated type
   */
  AutoGeneratedColumns extends keyof T = never,
> = {
  get: T;
  post: DeepSimplify<
    Omit<T, AutogeneratedOrNull<T, AutoGeneratedColumns>> &
      Partial<Pick<T, AutogeneratedOrNull<T, AutoGeneratedColumns>>>
  >;
  put: Required<T>;
  patch: Partial<T>;
};

export type VerticalFilterNameModifier = {
  name: string;
};

export type NumericTypes =
  | 'smallint'
  | 'integer'
  // TODO: implement - it requires some special cases for conversion
  // | 'bigint'
  | 'decimal'
  | 'float'
  | 'numeric'
  | 'real';

export type AlphabeticTypes = 'text' | 'character' | 'money' | 'bytea';

// TODO: add date, time and timestamp
type PostgresTypes = 'boolean' | AlphabeticTypes | NumericTypes;

export type VerticalFilterCastModifier = {
  cast?: PostgresTypes;
};

type RowType<Q> = DeepSimplify<
  UnionToIntersection<
    Q extends Query<infer DB, infer TN, any, infer R>
      ? R extends '*'
        ? DB[TN]['get']
        : R extends null
          ? DB[TN]['get']
          : R
      : never
  >
>;

export type Headers = {
  count?: Count;
  returning?: Returning;
  resolution?: ConflictResolution;
  schema?: string;
};

export type HeaderModifiers = Pick<Headers, 'count' | 'returning'>;

type Letter =
  | 'a'
  | 'b'
  | 'c'
  | 'd'
  | 'e'
  | 'f'
  | 'g'
  | 'h'
  | 'i'
  | 'j'
  | 'k'
  | 'l'
  | 'm'
  | 'n'
  | 'o'
  | 'p'
  | 'q'
  | 'r'
  | 's'
  | 't'
  | 'u'
  | 'v'
  | 'w'
  | 'x'
  | 'y'
  | 'z';

type VerticalAllFilter = '*';
export type VerticalColumnFilter<
  DB extends BaseDB,
  TableName extends keyof DB,
> = keyof DB[TableName]['get'];
export type CompositeFilter<
  DB extends BaseDB,
  TableName extends keyof DB,
> = `${Extract<keyof DB[TableName]['get'], string>}->${
  | Letter
  | Capitalize<Letter>}${string}`;
export type CompositeFilterWithModifier<
  DB extends BaseDB,
  TableName extends keyof DB,
> = readonly [CompositeFilter<DB, TableName>, VerticalFilterNameModifier];
export type CompositeStringFilter<
  DB extends BaseDB,
  TableName extends keyof DB,
> =
  | `${Extract<keyof DB[TableName]['get'], string>}->>${string}`
  | `${Extract<keyof DB[TableName]['get'], string>}->${string}->>${string}`;
export type CompositeStringFilterWithModifier<
  DB extends BaseDB,
  TableName extends keyof DB,
> = readonly [CompositeStringFilter<DB, TableName>, VerticalFilterNameModifier];
export type CompositeColumnFilter<
  DB extends BaseDB,
  TableName extends keyof DB,
> = {
  [K in keyof DB[TableName]['get']]: DB[TableName]['get'][K] extends
    | string
    | number
    ? never
    : Extract<K, string>;
}[keyof DB[TableName]['get']];
export type JsonColumnFilter<DB extends BaseDB, TableName extends keyof DB> =
  | CompositeFilter<DB, TableName>
  | CompositeColumnFilter<DB, TableName>
  | CompositeFilterWithModifier<DB, TableName>;
type VerticalColumnFilterWithModifier<
  DB extends BaseDB,
  TableName extends keyof DB,
> = readonly [
  keyof DB[TableName]['get'],
  Partial<VerticalFilterNameModifier> & VerticalFilterCastModifier,
];
type VerticalEmbeddedFilter<DB extends BaseDB> = Query<DB, keyof DB>;
type VerticalEmbeddedFilterWithModifier<DB extends BaseDB> = readonly [
  VerticalEmbeddedFilter<DB>,
  VerticalFilterNameModifier,
];

/**
 * A single selector type.
 *
 * @example
 * ```ts
 * '*'
 * // or
 * 'id'
 * // or
 * ['id', { cast: 'text', name: 'newName' }]
 * // or
 * Query<DB, TableName>
 * // or
 * [Query<DB, TableName>, { name: 'newName }]
 * ```
 */
export type VerticalFilterSelector<
  DB extends BaseDB,
  TableName extends keyof DB,
> =
  | VerticalAllFilter
  | VerticalColumnFilter<DB, TableName>
  | VerticalColumnFilterWithModifier<DB, TableName>
  | VerticalEmbeddedFilter<DB>
  | VerticalEmbeddedFilterWithModifier<DB>
  | CompositeStringFilter<DB, TableName>
  | CompositeStringFilterWithModifier<DB, TableName>;

/**
 * Return type for wildcard ("*" or [..., "*", ...])
 * @example
 * ```ts
 * // A is '*'
 * type A = VerticalAllFilterReturn<'*'>
 * // B is '*'
 * type B = VerticalAllFilterReturn<readonly ['*', 'something-else']>
 * ```
 */
type VerticalAllFilterReturn<Selector> = Selector extends VerticalAllFilter
  ? VerticalAllFilter
  : Selector extends ReadonlyArray<infer S>
    ? S extends VerticalAllFilter
      ? VerticalAllFilter
      : never
    : never;

/**
 * Utility type used for casting.
 * Returns a mapped type with only one property based on cast modifier.
 *
 * @example
 * ```ts
 * // A is { id: string }
 * type A = Cast<{ id: number, col: string }, 'id', { cast: 'text' }>
 * // B is object (empty)
 * type B = Cast<{ id: number, col: string }, 'id', {}>
 * ```
 */
type Cast<
  T extends object,
  Prop extends keyof T,
  M extends { cast?: PostgresTypes },
> = M['cast'] extends PostgresTypes
  ? {
      [_K in keyof Pick<T, Prop>]: M['cast'] extends AlphabeticTypes
        ? string
        : M['cast'] extends NumericTypes
          ? number
          : M['cast'] extends 'boolean'
            ? boolean
            : never;
    }
  : object;

/**
 * Utility type used for renaming.
 * Returns a mapped type with only one property based on name modifier.
 *
 * @example
 * ```ts
 * // A is { renamedId: number }
 * type A = Rename<{ id: number, col: string }, 'id', { name: 'renamedId' }>
 * // B is object (empty)
 * type B = Rename<{ id: number, col: string }, 'id', {}>
 * ```
 */
type Rename<
  T extends object,
  Prop extends keyof T,
  M extends { name?: string },
> = M['name'] extends string
  ? {
      [K in keyof Pick<T, Prop> as K extends Prop ? M['name'] : K]: T[K];
    }
  : object;

/**
 * Takes current response and selector and transforms the response type
 * if it finds a selector with modifier.
 * Selectors with modifiers look like `['id', { cast: 'text', name: 'newName' }]`.
 */
type VerticalColumnFilterWithModifiersReturn<
  DB extends BaseDB,
  TableName extends keyof DB,
  R extends object | '*' | null,
  Selector,
> = Selector extends VerticalColumnFilterWithModifier<DB, TableName>
  ? R extends '*'
    ? DB[TableName]['get'] &
        Rename<DB[TableName]['get'], Selector[0], Selector[1]> &
        Cast<DB[TableName]['get'], Selector[0], Selector[1]>
    : R extends null
      ? Rename<DB[TableName]['get'], Selector[0], Selector[1]> &
          Cast<DB[TableName]['get'], Selector[0], Selector[1]>
      : R &
          Rename<DB[TableName]['get'], Selector[0], Selector[1]> &
          Cast<DB[TableName]['get'], Selector[0], Selector[1]>
  : never;

/**
 * Takes current response and selector and transforms the response type
 * if it finds simple column selectors.
 * Simple column selectors look like `id` or `['id', 'col']`.
 */
type VerticalColumnFilterReturn<
  DB extends BaseDB,
  TableName extends keyof DB,
  R extends object | '*' | null,
  Selector,
> = Selector extends VerticalColumnFilter<DB, TableName>
  ? R extends '*'
    ? '*'
    : R extends null
      ? Pick<DB[TableName]['get'], Selector>
      : R & Pick<DB[TableName]['get'], Selector>
  : never;

type SubQueryReturn<
  DB extends BaseDB,
  TableName extends keyof DB,
  C extends Cardinality,
  R extends object | '*' | null,
  M extends TypeModifiers,
> = R extends null
  ? object
  : {
      [P in TableName]: C extends 'many'
        ? Array<R extends '*' ? DB[TableName]['get'] : DeepSimplify<R>>
        : R extends '*'
          ? DB[TableName]['get'] | (M['nullable'] extends true ? null : never)
          : DeepSimplify<R> | (M['nullable'] extends true ? null : never);
    };

type VerticalEmbeddedFilterReturn<
  DB extends BaseDB,
  TableName extends keyof DB,
  R extends object | '*' | null,
  Selector,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
> = Selector extends Query<DB, infer TN, infer C, infer RS, infer _H, infer M>
  ? R extends null
    ? SubQueryReturn<DB, TN, C, RS, M>
    : R extends '*'
      ? DB[TableName]['get'] & SubQueryReturn<DB, TN, C, RS, M>
      : R & SubQueryReturn<DB, TN, C, RS, M>
  : never;

type VerticalEmbeddedFilterWithModifierReturn<
  DB extends BaseDB,
  TableName extends keyof DB,
  R extends object | '*' | null,
  Selector,
> = Selector extends VerticalEmbeddedFilterWithModifier<DB>
  ? Selector[0] extends Query<
      DB,
      infer TN,
      infer C,
      infer RS,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      infer _H,
      infer M
    >
    ? R extends null
      ? TN extends keyof SubQueryReturn<DB, TN, C, RS, M>
        ? Rename<SubQueryReturn<DB, TN, C, RS, M>, TN, Selector[1]>
        : object
      : R extends '*'
        ? DB[TableName]['get'] &
            (TN extends keyof SubQueryReturn<DB, TN, C, RS, M>
              ? Rename<SubQueryReturn<DB, TN, C, RS, M>, TN, Selector[1]>
              : object)
        : R &
            (TN extends keyof SubQueryReturn<DB, TN, C, RS, M>
              ? Rename<SubQueryReturn<DB, TN, C, RS, M>, TN, Selector[1]>
              : object)
    : never
  : never;

type E<T> = T extends `${string}->>${infer Col}` ? Col : never;

type CompositeStringFilterReturn<
  DB extends BaseDB,
  TableName extends keyof DB,
  R extends object | '*' | null,
  Selector,
> = E<Selector> extends never
  ? never
  : R extends '*'
    ? DB[TableName]['get'] & { [P in E<Selector>]: string }
    : R extends null
      ? { [P in E<Selector>]: string }
      : R & { [P in E<Selector>]: string };

type CompositeStringFilterWithModifierReturn<
  DB extends BaseDB,
  TableName extends keyof DB,
  R extends object | '*' | null,
  Selector,
> = Selector extends CompositeStringFilterWithModifier<DB, TableName>
  ? R extends '*'
    ? Rename<
        DB[TableName]['get'] & { [P in E<Selector[0]>]: string },
        E<Selector[0]>,
        Selector[1]
      >
    : R extends null
      ? Rename<{ [P in E<Selector[0]>]: string }, E<Selector[0]>, Selector[1]>
      : R &
          Rename<{ [P in E<Selector[0]>]: string }, E<Selector[0]>, Selector[1]>
  : never;

/**
 * Takes Query generics (variables), as well as selectors, and transforms them
 * to another Query with different return generic (R).
 */
export type VerticalFilterReturn<
  DB extends BaseDB,
  TableName extends keyof DB,
  C extends Cardinality,
  R extends object | '*' | null,
  H extends HeaderModifiers,
  M extends TypeModifiers,
  Selector extends
    | VerticalFilterSelector<DB, TableName>
    | ReadonlyArray<VerticalFilterSelector<DB, TableName>>,
> = Query<
  DB,
  TableName,
  C,
  Selector extends VerticalColumnFilterWithModifier<DB, TableName>
    ? VerticalColumnFilterWithModifiersReturn<DB, TableName, R, Selector>
    : Selector extends VerticalEmbeddedFilterWithModifier<DB>
      ? VerticalEmbeddedFilterWithModifierReturn<DB, TableName, R, Selector>
      : Selector extends CompositeStringFilterWithModifier<DB, TableName>
        ? CompositeStringFilterWithModifierReturn<DB, TableName, R, Selector>
        : Selector extends ReadonlyArray<infer S>
          ?
              | VerticalAllFilterReturn<S>
              | VerticalColumnFilterReturn<DB, TableName, R, S>
              | VerticalColumnFilterWithModifiersReturn<DB, TableName, R, S>
              | CompositeStringFilterReturn<DB, TableName, R, S>
              | CompositeStringFilterWithModifierReturn<DB, TableName, R, S>
              | VerticalEmbeddedFilterReturn<DB, TableName, R, S>
              | VerticalEmbeddedFilterWithModifierReturn<DB, TableName, R, S>
          :
              | VerticalAllFilterReturn<Selector>
              | VerticalColumnFilterReturn<DB, TableName, R, Selector>
              | VerticalColumnFilterWithModifiersReturn<
                  DB,
                  TableName,
                  R,
                  Selector
                >
              | CompositeStringFilterReturn<DB, TableName, R, Selector>
              | CompositeStringFilterWithModifierReturn<
                  DB,
                  TableName,
                  R,
                  Selector
                >
              | VerticalEmbeddedFilterReturn<DB, TableName, R, Selector>
              | VerticalEmbeddedFilterWithModifierReturn<
                  DB,
                  TableName,
                  R,
                  Selector
                >,
  H,
  M
>;

type JsonColumnFilterReturn<
  DB extends BaseDB,
  TableName extends keyof DB,
  R extends object | '*' | null,
  Extender,
> = R extends '*'
  ? DeepSimplify<DB[TableName]['get'] & Extender>
  : R extends null
    ? Extender
    : DeepSimplify<R & Extender>;

export type VerticalJsonFilterReturn<
  DB extends BaseDB,
  TableName extends keyof DB,
  C extends Cardinality,
  R extends object | '*' | null,
  H extends HeaderModifiers,
  Extender extends Record<string, any>,
> = Query<
  DB,
  TableName,
  C,
  // TODO: inline it
  JsonColumnFilterReturn<DB, TableName, R, Extender>,
  H
>;

export type CountMetadata<Method extends HttpMethod, Q> = Q extends Query<
  any,
  any,
  any,
  any,
  infer H
>
  ? H['count'] extends NonNullable<H['count']>
    ? Method extends 'GET' | 'HEAD'
      ? { pagesLength: number; totalLength: number }
      : { totalLength: number }
    : object
  : object;

/**
 * Utility type to transform Query into a result.
 * It should return different types based on Query generics.
 */
export type GetQueryToResponse<Q> = Q extends Query<any, any, infer C>
  ? C extends 'one'
    ? { row: RowType<Q> }
    : { rows: RowType<Q>[] } & CountMetadata<'GET', Q>
  : never;

export type PostRequestData<Q> = Q extends Query<infer DB, infer TN>
  ? DB[TN]['post'] | DB[TN]['post'][]
  : never;

export type PatchRequestData<Q> = Q extends Query<infer DB, infer TN>
  ? DB[TN]['patch']
  : never;

export type PutRequestData<Q> = Q extends Query<infer DB, infer TN>
  ? DB[TN]['put']
  : never;

export type PostQueryToResponse<Q> = Q extends Query<
  any,
  any,
  infer C,
  any,
  infer H
>
  ? H['returning'] extends 'headers-only'
    ? { location: string } & CountMetadata<'POST', Q>
    : H['returning'] extends 'representation'
      ? C extends 'one'
        ? { row: RowType<Q> } & CountMetadata<'POST', Q>
        : { rows: RowType<Q>[] } & CountMetadata<'POST', Q>
      : CountMetadata<'POST', Q>
  : never;

export type PatchQueryToResponse<Q> = Q extends Query<
  any,
  any,
  infer C,
  any,
  infer H
>
  ? H['returning'] extends 'headers-only'
    ? CountMetadata<'PATCH', Q>
    : H['returning'] extends 'representation'
      ? C extends 'one'
        ? { row: RowType<Q> } & CountMetadata<'PATCH', Q>
        : { rows: RowType<Q>[] } & CountMetadata<'PATCH', Q>
      : CountMetadata<'PATCH', Q>
  : never;

export type PutQueryToResponse<Q> = Q extends Query<
  any,
  any,
  infer C,
  any,
  infer H
>
  ? H['returning'] extends 'headers-only'
    ? object
    : H['returning'] extends 'representation'
      ? C extends 'one'
        ? { row: RowType<Q> }
        : { rows: RowType<Q>[] }
      : object
  : never;

export type DeleteQueryToResponse<Q> = Q extends Query<
  any,
  any,
  infer C,
  any,
  infer H
>
  ? H['returning'] extends 'headers-only'
    ? CountMetadata<'DELETE', Q>
    : H['returning'] extends 'representation'
      ? C extends 'one'
        ? { row: RowType<Q> } & CountMetadata<'DELETE', Q>
        : { rows: RowType<Q>[] } & CountMetadata<'DELETE', Q>
      : CountMetadata<'DELETE', Q>
  : never;
