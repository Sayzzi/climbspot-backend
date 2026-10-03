import type { Express } from 'express';
import { pino } from 'pino';
import { afterAll, beforeAll, beforeEach } from 'vitest';

import { createApp } from '../src/app.ts';
import { createAccountsModule } from '../src/modules/accounts/index.ts';
import { createDatabase, type DatabaseConnection } from '../src/shared/infrastructure/database.ts';
import { createTestDatabase, type TestDatabase } from './database.ts';
import { fakeIdentityVerifier } from './identity.ts';

/**
 * Gives the calling test file its own migrated database, emptied before each test,
 * and a factory for the HTTP application wired with the Accounts module.
 */
export function useAccountsApp(): () => Express {
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

  beforeEach(() => testDatabase.truncate());

  return () =>
    createApp({
      logger: pino({ level: 'silent' }),
      corsOrigins: [],
      identityVerifier: fakeIdentityVerifier,
      modules: [createAccountsModule({ db: connection.db })],
    });
}
