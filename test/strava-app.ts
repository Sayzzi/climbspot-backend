import type { Express } from 'express';
import { pino } from 'pino';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach } from 'vitest';

import { createApp } from '../src/app.ts';
import { createAccountsModule } from '../src/modules/accounts/index.ts';
import {
  createStravaModule,
  forgetStravaConnection,
  type StravaGateway,
} from '../src/modules/strava/index.ts';
import {
  createDatabase,
  type Database,
  type DatabaseConnection,
} from '../src/shared/infrastructure/database.ts';
import { fakeAccountDirectory } from './accounts-app.ts';
import { createTestDatabase, type TestDatabase } from './database.ts';
import type { Identity } from '../src/shared/domain/identity.ts';
import { fakeIdentityVerifier, tokenFor } from './identity.ts';
import { fakeStrava, STRAVA_CODES } from './strava.ts';

/** The key test tokens are encrypted with: 32 bytes, base64. */
export const TEST_TOKEN_KEY = Buffer.alloc(32, 7).toString('base64');

export interface StravaApp {
  (options?: { gateway?: StravaGateway }): Express;
  /** The test database, to look at what the API never shows. */
  readonly db: () => Database;
}

/**
 * Its own migrated database per test file, and the app with the Strava Connection and
 * the account deletion that ends it.
 */
export function useStravaApp(): StravaApp {
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

  const build = ({ gateway = fakeStrava().gateway }: { gateway?: StravaGateway } = {}) => {
    const strava = { gateway, tokenKey: TEST_TOKEN_KEY };
    return createApp({
      logger: pino({ level: 'silent' }),
      corsOrigins: [],
      identityVerifier: fakeIdentityVerifier,
      modules: [
        createStravaModule({ db: connection.db, ...strava }),
        createAccountsModule({
          db: connection.db,
          directory: fakeAccountDirectory().directory,
          erasers: [forgetStravaConnection(strava)],
        }),
      ],
    });
  };
  return Object.assign(build, { db: () => connection.db });
}

export const as = (visitor: Identity) => ({ Authorization: `Bearer ${tokenFor(visitor)}` });

/** The state the API gives the Visitor for Strava's authorisation. */
export async function stateFor(app: Express, visitor: Identity): Promise<string> {
  const response = await request(app).get('/strava/authorize').set(as(visitor));
  return new URL((response.body as { url: string }).url).searchParams.get('state') ?? '';
}

/** Connects the Visitor as Strava would send them back with `code`. */
export async function connect(
  app: Express,
  visitor: Identity,
  code: string = STRAVA_CODES.ada.code,
) {
  const state = await stateFor(app, visitor);
  return request(app).post('/strava/connection').set(as(visitor)).send({ code, state });
}

export const connectionOf = async (app: Express, visitor: Identity) =>
  (await request(app).get('/strava/connection').set(as(visitor))).body as Record<string, unknown>;
