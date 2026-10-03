import type { HttpModule } from '../../shared/http/http-module.ts';
import { CachedPlanner } from './application/cached-planner.ts';
import { FindUphillItineraries } from './application/find-uphill-itineraries.ts';
import { GenerateLoops } from './application/generate-loops.ts';
import { PlanHillSessions } from './application/plan-hill-sessions.ts';
import type { RoutingProvider } from './domain/routing-provider.ts';
import { registerItinerariesOpenApi } from './http/itineraries.openapi.ts';
import { createItinerariesRouter } from './http/itineraries.router.ts';

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
