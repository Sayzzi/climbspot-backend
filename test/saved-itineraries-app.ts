import type { Express } from 'express';
import { pino } from 'pino';
import { afterAll, beforeAll, beforeEach } from 'vitest';

import { createApp } from '../src/app.ts';
import { createSavedItinerariesModule } from '../src/modules/itineraries/index.ts';
import { createDatabase, type DatabaseConnection } from '../src/shared/infrastructure/database.ts';
import { createTestDatabase, type TestDatabase } from './database.ts';
import { fakeIdentityVerifier } from './identity.ts';

/** Its own migrated database per test file, and the app with Saved Itineraries. */
export function useSavedItinerariesApp(): () => Express {
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
      modules: [createSavedItinerariesModule({ db: connection.db, now: tick() })],
    });
}

/** A clock moving a second at each reading, so that saves get distinct times. */
function tick() {
  let seconds = 0;
  return () => new Date(Date.UTC(2026, 9, 1, 12, 0, (seconds += 1)));
}
