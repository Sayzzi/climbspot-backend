import type { Express } from 'express';
import { pino } from 'pino';
import { afterAll, beforeAll, beforeEach } from 'vitest';

import { createApp } from '../src/app.ts';
import type { AccountDirectory } from '../src/modules/accounts/domain/account-directory.ts';
import { createAccountsModule, type VisitorDataEraserFor } from '../src/modules/accounts/index.ts';
import { createAscentsModule, forgetContributor } from '../src/modules/ascents/index.ts';
import {
  createSavedItinerariesModule,
  forgetSavedItineraries,
} from '../src/modules/itineraries/index.ts';
import {
  createDatabase,
  type Database,
  type DatabaseConnection,
} from '../src/shared/infrastructure/database.ts';
import { createTestDatabase, type TestDatabase } from './database.ts';
import { fakeIdentityVerifier } from './identity.ts';
import { uniformGradient } from './terrain.ts';

/** An account directory recording the accounts it deleted, or failing like Supabase down. */
export function fakeAccountDirectory({ failing = false } = {}) {
  const deleted: string[] = [];
  const directory: AccountDirectory = {
    deleteVisitor: (visitorId) => {
      if (failing) {
        return Promise.reject(new Error('Supabase is down'));
      }
      deleted.push(visitorId);
      return Promise.resolve();
    },
  };
  return { directory, deleted };
}

export interface AccountsAppOptions {
  readonly directory?: AccountDirectory;
  /** More to erase with an account, after the Ascents and Saved Itineraries. */
  readonly alsoErase?: readonly VisitorDataEraserFor[];
}

export interface AccountsApp {
  (options?: AccountsAppOptions): Express;
  /** The test database, to look at what the API never shows. */
  readonly db: () => Database;
}

/**
 * Gives the calling test file its own migrated database, emptied before each test, and a
 * factory for the HTTP application with Accounts, the Ascents and Saved Itineraries
 * their deletion reaches.
 */
export function useAccountsApp(): AccountsApp {
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

  const build = ({
    directory = fakeAccountDirectory().directory,
    alsoErase = [],
  }: AccountsAppOptions = {}) =>
    createApp({
      logger: pino({ level: 'silent' }),
      corsOrigins: [],
      identityVerifier: fakeIdentityVerifier,
      modules: [
        createAccountsModule({
          db: connection.db,
          directory,
          erasers: [forgetContributor, forgetSavedItineraries, ...alsoErase],
        }),
        createAscentsModule({ db: connection.db, elevationProvider: uniformGradient(0.08) }),
        createSavedItinerariesModule({ db: connection.db }),
      ],
    });
  return Object.assign(build, { db: () => connection.db });
}
