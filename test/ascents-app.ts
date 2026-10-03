import type { Express } from 'express';
import { pino } from 'pino';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach } from 'vitest';

import { createApp } from '../src/app.ts';
import type { ElevationProvider } from '../src/modules/ascents/domain/elevation-provider.ts';
import { createAscentsModule } from '../src/modules/ascents/index.ts';
import { createDatabase, type DatabaseConnection } from '../src/shared/infrastructure/database.ts';
import { createTestDatabase, type TestDatabase } from './database.ts';
import type { Identity } from '../src/shared/domain/identity.ts';
import { fakeIdentityVerifier, tokenFor, VISITOR_A } from './identity.ts';
import { uniformGradient } from './terrain.ts';

export interface AscentsAppOptions {
  readonly terrain?: ElevationProvider;
}

/**
 * Gives the calling test file its own migrated database, emptied before each test,
 * and a factory for the HTTP application wired with the Ascents module.
 */
export function useAscentsApp(): (options?: AscentsAppOptions) => Express {
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

  return ({ terrain = uniformGradient(0.08) } = {}) =>
    createApp({
      logger: pino({ level: 'silent' }),
      corsOrigins: [],
      identityVerifier: fakeIdentityVerifier,
      modules: [createAscentsModule({ db: connection.db, elevationProvider: terrain })],
    });
}

export interface UploadFields {
  readonly name?: string;
  readonly surface?: string;
  /** The signed-in Visitor uploading, Visitor A by default; `null` for nobody. */
  readonly as?: Identity | null;
}

export function uploadGpx(app: Express, gpx: string | Buffer, fields: UploadFields = {}) {
  const contributor = fields.as === undefined ? VISITOR_A : fields.as;
  const call = request(app).post('/ascents');
  return (contributor ? call.set('Authorization', `Bearer ${tokenFor(contributor)}`) : call)
    .field('name', fields.name ?? 'Côte de test')
    .field('surface', fields.surface ?? 'paved')
    .attach('gpx', Buffer.from(gpx), {
      filename: 'ascent.gpx',
      contentType: 'application/gpx+xml',
    });
}
