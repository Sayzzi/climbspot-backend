import { createApp } from './app.ts';
import { createHealthModule } from './modules/health/index.ts';
import { loadEnv } from './shared/config/env.ts';
import { createDatabase } from './shared/infrastructure/database.ts';
import { createLogger } from './shared/infrastructure/logger.ts';

// Composition root: the only place where concrete implementations are chosen and wired together.
const env = loadEnv();
const logger = createLogger({ level: env.LOG_LEVEL, pretty: env.NODE_ENV === 'development' });
const database = createDatabase(env.DATABASE_URL);

const app = createApp({
  logger,
  corsOrigins: env.CORS_ORIGINS,
  modules: [createHealthModule()],
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
