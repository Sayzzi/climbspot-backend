import { createApp } from './app.ts';
import { createAscentsModule, OpenMeteoElevationProvider } from './modules/ascents/index.ts';
import { createAccountsModule } from './modules/accounts/index.ts';
import { createHealthModule } from './modules/health/index.ts';
import {
  createItinerariesModule,
  OpenRouteServiceRoutingProvider,
} from './modules/itineraries/index.ts';
import { loadEnv } from './shared/config/env.ts';
import { createDatabase } from './shared/infrastructure/database.ts';
import { createLogger } from './shared/infrastructure/logger.ts';
import { SupabaseIdentityVerifier } from './shared/infrastructure/supabase-identity-verifier.ts';

// Composition root: the only place where concrete implementations are chosen and wired together.
const env = loadEnv();
const logger = createLogger({ level: env.LOG_LEVEL, pretty: env.NODE_ENV === 'development' });
const database = createDatabase(env.DATABASE_URL);

const app = createApp({
  logger,
  corsOrigins: env.CORS_ORIGINS,
  identityVerifier: new SupabaseIdentityVerifier({ projectUrl: env.SUPABASE_URL }),
  modules: [
    createHealthModule(),
    createAccountsModule({ db: database.db }),
    createAscentsModule({
      db: database.db,
      elevationProvider: new OpenMeteoElevationProvider({ baseUrl: env.ELEVATION_API_URL }),
      creationEnabled: env.ASCENT_CREATION_ENABLED,
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
