import { randomUUID } from 'node:crypto';

import type { HttpModule } from '../../shared/http/http-module.ts';
import type { Database } from '../../shared/infrastructure/database.ts';
import { CreateAscent } from './application/create-ascent.ts';
import { GetAscent } from './application/get-ascent.ts';
import type { ElevationProvider } from './domain/elevation-provider.ts';
import { registerAscentsOpenApi } from './http/ascents.openapi.ts';
import { createAscentsRouter } from './http/ascents.router.ts';
import { DrizzleAscentRepository } from './infrastructure/persistence/drizzle-ascent-repository.ts';

export { OpenMeteoElevationProvider } from './infrastructure/open-meteo-elevation-provider.ts';

export interface AscentsModuleDependencies {
  readonly db: Database;
  readonly elevationProvider: ElevationProvider;
  /** Temporary guard until Contributors are authenticated. */
  readonly creationEnabled: boolean;
}

const basePath = '/ascents';

export function createAscentsModule({
  db,
  elevationProvider,
  creationEnabled,
}: AscentsModuleDependencies): HttpModule {
  const repository = new DrizzleAscentRepository(db);

  const createAscent = new CreateAscent({
    repository,
    elevationProvider,
    creationEnabled,
    newId: randomUUID,
    now: () => new Date(),
  });
  const getAscent = new GetAscent(repository);

  return {
    basePath,
    router: createAscentsRouter({ createAscent, getAscent }),
    registerOpenApi: (registry) => {
      registerAscentsOpenApi(registry, basePath);
    },
  };
}
