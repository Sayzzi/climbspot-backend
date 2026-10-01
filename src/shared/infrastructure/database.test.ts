import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestDatabase, type TestDatabase } from '../../../test/database.ts';
import { createDatabase, type DatabaseConnection } from './database.ts';

describe('createDatabase', () => {
  let testDatabase: TestDatabase;
  let connection: DatabaseConnection;

  beforeAll(async () => {
    testDatabase = await createTestDatabase();
    connection = createDatabase(testDatabase.url);
  });

  afterAll(async () => {
    await connection.close();
    await testDatabase.drop();
  });

  it('installs PostGIS in the extensions schema, like Supabase', async () => {
    const rows = await connection.db.execute<{ schema: string }>(
      sql`select n.nspname as schema from pg_extension e join pg_namespace n on n.oid = e.extnamespace where e.extname = 'postgis'`,
    );

    expect(rows).toEqual([{ schema: 'extensions' }]);
  });

  it('resolves PostGIS functions without schema qualification', async () => {
    const rows = await connection.db.execute<{ point: string }>(
      sql`select st_astext(st_makepoint(5.278, 44.174)) as point`,
    );

    expect(rows).toEqual([{ point: 'POINT(5.278 44.174)' }]);
  });
});
