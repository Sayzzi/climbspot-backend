import { randomUUID } from 'node:crypto';

import type { HttpModule } from '../../shared/http/http-module.ts';
import type { Database } from '../../shared/infrastructure/database.ts';
import { CachedPlanner } from './application/cached-planner.ts';
import { FindUphillItineraries } from './application/find-uphill-itineraries.ts';
import { GenerateLoops } from './application/generate-loops.ts';
import { PlanHillSessions } from './application/plan-hill-sessions.ts';
import { SavedItineraries } from './application/saved-itineraries.ts';
import type { RoutingProvider } from './domain/routing-provider.ts';
import { registerItinerariesOpenApi } from './http/itineraries.openapi.ts';
import { createItinerariesRouter } from './http/itineraries.router.ts';
import { registerSavedItinerariesOpenApi } from './http/saved-itineraries.openapi.ts';
import { createSavedItinerariesRouter } from './http/saved-itineraries.router.ts';
import { DrizzleSavedItineraryRepository } from './infrastructure/persistence/drizzle-saved-itinerary-repository.ts';

export { OpenRouteServiceRoutingProvider } from './infrastructure/open-route-service-routing-provider.ts';

export interface ItinerariesModuleDependencies {
  readonly routingProvider: RoutingProvider;
  /** Clock for the planning cache, in milliseconds (defaults to `Date.now`). */
  readonly now?: () => number;
}

const basePath = '/itineraries';

export function createItinerariesModule({
  routingProvider,
  now = Date.now,
}: ItinerariesModuleDependencies): HttpModule {
  return {
    basePath,
    router: createItinerariesRouter({
      findUphillItineraries: new CachedPlanner(new FindUphillItineraries(routingProvider), now),
      generateLoops: new CachedPlanner(new GenerateLoops(routingProvider), now),
      planHillSessions: new CachedPlanner(new PlanHillSessions(routingProvider), now),
    }),
    registerOpenApi: (registry) => {
      registerItinerariesOpenApi(registry, basePath);
    },
  };
}

export interface SavedItinerariesModuleDependencies {
  readonly db: Database;
  /** Clock stamping saves (defaults to now). */
  readonly now?: () => Date;
}

const savedBasePath = '/saved-itineraries';

/** Saved Itineraries: frozen copies of proposals, each signed-in Visitor's own. */
export function createSavedItinerariesModule({
  db,
  now = () => new Date(),
}: SavedItinerariesModuleDependencies): HttpModule {
  const savedItineraries = new SavedItineraries({
    repository: new DrizzleSavedItineraryRepository(db),
    newId: randomUUID,
    now,
  });
  return {
    basePath: savedBasePath,
    router: createSavedItinerariesRouter(savedItineraries),
    registerOpenApi: (registry) => {
      registerSavedItinerariesOpenApi(registry, savedBasePath);
    },
  };
}
