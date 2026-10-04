import { randomUUID } from 'node:crypto';

import type { HttpModule } from '../../shared/http/http-module.ts';
import type { Database } from '../../shared/infrastructure/database.ts';
import { CreateAscent } from './application/create-ascent.ts';
import { FindAscentsNearby } from './application/find-ascents-nearby.ts';
import { GetAscent } from './application/get-ascent.ts';
import { GetMyAscentTimes } from './application/get-my-ascent-times.ts';
import type { Bounds } from '../../shared/domain/position.ts';
import type { ElevationProvider } from './domain/elevation-provider.ts';
import {
  noAscentTimes,
  type AscentAddedListener,
  type PersonalAscentTimes,
} from './domain/personal-ascent-times.ts';
import { registerAscentsOpenApi } from './http/ascents.openapi.ts';
import { createAscentsRouter } from './http/ascents.router.ts';
import { readGpxPath } from './infrastructure/gpx/gpx-path-reader.ts';
import { DrizzleAscentRepository } from './infrastructure/persistence/drizzle-ascent-repository.ts';

export { OpenMeteoElevationProvider } from './infrastructure/open-meteo-elevation-provider.ts';

export interface AscentsModuleDependencies {
  readonly db: Database;
  readonly elevationProvider: ElevationProvider;
  /** Each Visitor's own Ascent Times; none by default. */
  readonly ascentTimes?: PersonalAscentTimes;
  /** Told of every Ascent added. */
  readonly onAscentAdded?: AscentAddedListener;
}

const basePath = '/ascents';

export function createAscentsModule({
  db,
  elevationProvider,
  ascentTimes = noAscentTimes,
  onAscentAdded = () => Promise.resolve(),
}: AscentsModuleDependencies): HttpModule {
  const repository = new DrizzleAscentRepository(db);

  const createAscent = new CreateAscent({
    repository,
    elevationProvider,
    newId: randomUUID,
    now: () => new Date(),
    onAscentAdded,
  });
  const getAscent = new GetAscent(repository);
  const findAscentsNearby = new FindAscentsNearby(repository, ascentTimes);
  const getMyAscentTimes = new GetMyAscentTimes(repository, ascentTimes);

  return {
    basePath,
    router: createAscentsRouter({
      createAscent,
      getAscent,
      findAscentsNearby,
      getMyAscentTimes,
      readGpxPath,
    }),
    registerOpenApi: (registry) => {
      registerAscentsOpenApi(registry, basePath);
    },
  };
}

/** Erases who added Ascents when a Contributor's account is deleted; the Ascents stay. */
export function forgetContributor(db: Database) {
  const repository = new DrizzleAscentRepository(db);
  return {
    erase: async (visitorId: string) => {
      await repository.forgetContributor(visitorId);
      return undefined;
    },
  };
}

/** The Ascents of the catalogue whose Start lies within a box, with their paths. */
export function ascentCatalogue(db: Database) {
  const repository = new DrizzleAscentRepository(db);
  return { startingWithin: (bounds: Bounds) => repository.findStartingWithin(bounds) };
}
