import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';

import { errorHandler } from './shared/http/error-handler.ts';
import type { HttpModule } from './shared/http/http-module.ts';
import { identify, nobodySignedIn, type IdentityVerifier } from './shared/http/identity.ts';
import { notFoundHandler } from './shared/http/not-found-handler.ts';
import { buildOpenApiDocument } from './shared/http/openapi.ts';
import type { Logger } from './shared/infrastructure/logger.ts';

export interface AppDependencies {
  readonly logger: Logger;
  readonly corsOrigins: readonly string[];
  readonly modules: readonly HttpModule[];
  /** Tells signed-in Visitors from their access tokens; by default nobody is signed in. */
  readonly identityVerifier?: IdentityVerifier;
}

/**
 * Builds the HTTP application from already-wired modules.
 * Kept free of I/O (no `listen`, no env access) so tests can exercise it in-process.
 */
export function createApp({
  logger,
  corsOrigins,
  modules,
  identityVerifier = nobodySignedIn,
}: AppDependencies): Express {
  const app = express();
  const openApiDocument = buildOpenApiDocument(modules);

  app.use(pinoHttp({ logger }));
  app.use(helmet());
  app.use(cors({ origin: [...corsOrigins] }));
  app.use(express.json({ limit: '1mb' }));
  app.use(identify(identityVerifier));

  app.get('/openapi.json', (_req, res) => {
    res.json(openApiDocument);
  });

  for (const module of modules) {
    app.use(module.basePath, module.router);
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
