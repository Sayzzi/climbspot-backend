import type { PgDatabase } from 'drizzle-orm/pg-core';
import { drizzle, type PostgresJsQueryResultHKT } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

/** The database, or a transaction on it: repositories work the same in both. */
export type Database = PgDatabase<PostgresJsQueryResultHKT>;

export interface DatabaseConnection {
  readonly db: Database;
  close(): Promise<void>;
}

export function createDatabase(url: string): DatabaseConnection {
  const client = postgres(url, {
    // Supabase's transaction pooler does not support prepared statements.
    prepare: false,
    // PostGIS lives in the `extensions` schema (see the first migration).
    connection: { search_path: '"$user", public, extensions' },
    onnotice: () => undefined,
  });

  return {
    db: drizzle({ client }),
    close: () => client.end(),
  };
}
