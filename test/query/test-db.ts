import { PostgresTable } from '../../src/types';

type TestTable = PostgresTable<{ id: number; col1: string }, 'id'>;
type TestTable2 = PostgresTable<{ id: number; table1_id: number }, 'id'>;
type JsonTestTable = PostgresTable<{
  id: number;
  // NOTE: this could be JSON, but this could also be a composite column
  json_column: { someVal: number };
  array_composite: number[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  json_column2: any;
}>;
type NullsTable = PostgresTable<{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  json_column: any | null;
  nullable: string | null;
}>;
type DB = {
  test_table: TestTable;
  test_table2: TestTable2;
  json_test_table: JsonTestTable;
  nulls_table: NullsTable;
};

export default DB;
