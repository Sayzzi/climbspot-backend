import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

export type Database = PostgresJsDatabase;

export interface DatabaseConnection {
  readonly db: Database;
  close(): Promise<void>;
}

export function createDatabase(url: string): DatabaseConnection {
  // Supabase's transaction pooler does not support prepared statements.
  const client = postgres(url, { prepare: false });

  return {
    db: drizzle({ client }),
    close: () => client.end(),
  };
}
