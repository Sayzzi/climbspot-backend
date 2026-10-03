import { randomUUID } from 'node:crypto';

import type { HttpModule } from '../../shared/http/http-module.ts';
import type { Database } from '../../shared/infrastructure/database.ts';
import { CreateAscent } from './application/create-ascent.ts';
import { FindAscentsNearby } from './application/find-ascents-nearby.ts';
import { GetAscent } from './application/get-ascent.ts';
import type { ElevationProvider } from './domain/elevation-provider.ts';
import { registerAscentsOpenApi } from './http/ascents.openapi.ts';
import { createAscentsRouter } from './http/ascents.router.ts';
import { readGpxPath } from './infrastructure/gpx/gpx-path-reader.ts';
import { DrizzleAscentRepository } from './infrastructure/persistence/drizzle-ascent-repository.ts';

export { OpenMeteoElevationProvider } from './infrastructure/open-meteo-elevation-provider.ts';

export interface AscentsModuleDependencies {
  readonly db: Database;
  readonly elevationProvider: ElevationProvider;
}

const basePath = '/ascents';

export function createAscentsModule({
  db,
  elevationProvider,
}: AscentsModuleDependencies): HttpModule {
  const repository = new DrizzleAscentRepository(db);

  const createAscent = new CreateAscent({
    repository,
    elevationProvider,
    newId: randomUUID,
    now: () => new Date(),
  });
  const getAscent = new GetAscent(repository);
  const findAscentsNearby = new FindAscentsNearby(repository);

  return {
    basePath,
    router: createAscentsRouter({ createAscent, getAscent, findAscentsNearby, readGpxPath }),
    registerOpenApi: (registry) => {
      registerAscentsOpenApi(registry, basePath);
    },
  };
}
