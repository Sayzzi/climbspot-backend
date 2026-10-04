import { randomBytes } from 'node:crypto';

import { createApp } from './app.ts';
import {
  createAscentsModule,
  forgetContributor,
  OpenMeteoElevationProvider,
} from './modules/ascents/index.ts';
import {
  createAccountsModule,
  SupabaseAccountDirectory,
  type AccountDirectory,
} from './modules/accounts/index.ts';
import { createHealthModule } from './modules/health/index.ts';
import {
  createItinerariesModule,
  createSavedItinerariesModule,
  forgetSavedItineraries,
  OpenRouteServiceRoutingProvider,
} from './modules/itineraries/index.ts';
import {
  createStravaModule,
  forgetStravaConnection,
  StravaApiGateway,
  unavailableStrava,
  type StravaSettings,
} from './modules/strava/index.ts';
import { loadEnv } from './shared/config/env.ts';
import { createDatabase } from './shared/infrastructure/database.ts';
import { createLogger } from './shared/infrastructure/logger.ts';
import { SupabaseIdentityVerifier } from './shared/infrastructure/supabase-identity-verifier.ts';

// Composition root: the only place where concrete implementations are chosen and wired together.
const env = loadEnv();
const logger = createLogger({ level: env.LOG_LEVEL, pretty: env.NODE_ENV === 'development' });
const database = createDatabase(env.DATABASE_URL);

// Without the service-role key, deleting an account fails before erasing anything.
const accountDirectory: AccountDirectory = env.SUPABASE_SERVICE_ROLE_KEY
  ? new SupabaseAccountDirectory({
      projectUrl: env.SUPABASE_URL,
      serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    })
  : { deleteVisitor: () => Promise.reject(new Error('SUPABASE_SERVICE_ROLE_KEY is not set')) };

// Without a Strava application, connecting to Strava answers that it is unavailable.
const strava: StravaSettings =
  env.STRAVA_CLIENT_ID && env.STRAVA_CLIENT_SECRET && env.STRAVA_TOKEN_KEY
    ? {
        gateway: new StravaApiGateway({
          clientId: env.STRAVA_CLIENT_ID,
          clientSecret: env.STRAVA_CLIENT_SECRET,
          redirectUrl: env.STRAVA_REDIRECT_URL,
        }),
        tokenKey: env.STRAVA_TOKEN_KEY,
      }
    : { gateway: unavailableStrava, tokenKey: randomBytes(32).toString('base64') };

const app = createApp({
  logger,
  corsOrigins: env.CORS_ORIGINS,
  identityVerifier: new SupabaseIdentityVerifier({ projectUrl: env.SUPABASE_URL }),
  modules: [
    createHealthModule(),
    createAccountsModule({
      db: database.db,
      directory: accountDirectory,
      erasers: [forgetContributor, forgetSavedItineraries, forgetStravaConnection(strava)],
    }),
    createSavedItinerariesModule({ db: database.db }),
    createStravaModule({ db: database.db, ...strava }),
    createAscentsModule({
      db: database.db,
      elevationProvider: new OpenMeteoElevationProvider({ baseUrl: env.ELEVATION_API_URL }),
    }),
    createItinerariesModule({
      routingProvider: new OpenRouteServiceRoutingProvider({
        baseUrl: env.ORS_URL,
        ...(env.ORS_API_KEY !== undefined && { apiKey: env.ORS_API_KEY }),
      }),
    }),
  ],
});

const server = app.listen(env.PORT, () => {
  logger.info(`API listening on http://localhost:${String(env.PORT)}`);
});

function shutdown(signal: NodeJS.Signals): void {
  logger.info(`${signal} received, shutting down`);

  server.close(() => {
    database
      .close()
      .then(() => process.exit(0))
      .catch((error: unknown) => {
        logger.error({ err: error }, 'Failed to close the database connection');
        process.exit(1);
      });
  });
}

process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
