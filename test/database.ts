import { randomUUID } from 'node:crypto';

import postgres from 'postgres';
import { inject } from 'vitest';

import { withDatabase } from './postgres-url.ts';

export interface TestDatabase {
  /** Connection URL of a freshly migrated database owned by the calling test file. */
  readonly url: string;
  /** Empties every application table, e.g. between tests. */
  truncate(): Promise<void>;
  drop(): Promise<void>;
}

export async function createTestDatabase(): Promise<TestDatabase> {
  const adminUrl = inject('databaseAdminUrl');
  const name = `test_${randomUUID().replaceAll('-', '')}`;
  const url = withDatabase(adminUrl, name);

  await withClient(adminUrl, (sql) =>
    sql.unsafe(`create database ${name} template ${inject('databaseTemplate')}`),
  );

  return {
    url,
    truncate: () =>
      withClient(url, async (sql) => {
        const tables = await sql<{ name: string }[]>`
          select quote_ident(tablename) as name from pg_tables where schemaname = 'public'`;
        if (tables.length > 0) {
          await sql.unsafe(`truncate ${tables.map((table) => table.name).join(', ')} cascade`);
        }
      }),
    drop: () => withClient(adminUrl, (sql) => sql.unsafe(`drop database ${name} with (force)`)),
  };
}

async function withClient(
  url: string,
  run: (sql: postgres.Sql) => Promise<unknown>,
): Promise<void> {
  const sql = postgres(url, { max: 1, onnotice: () => undefined });
  try {
    await run(sql);
  } finally {
    await sql.end();
  }
}
