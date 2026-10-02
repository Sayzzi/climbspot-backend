import type { HttpModule } from '../../shared/http/http-module.ts';
import { FindUphillItineraries } from './application/find-uphill-itineraries.ts';
import type { RoutingProvider } from './domain/routing-provider.ts';
import { registerItinerariesOpenApi } from './http/itineraries.openapi.ts';
import { createItinerariesRouter } from './http/itineraries.router.ts';

export { OpenRouteServiceRoutingProvider } from './infrastructure/open-route-service-routing-provider.ts';

export interface ItinerariesModuleDependencies {
  readonly routingProvider: RoutingProvider;
}

const basePath = '/itineraries';

export function createItinerariesModule({
  routingProvider,
}: ItinerariesModuleDependencies): HttpModule {
  return {
    basePath,
    router: createItinerariesRouter({
      findUphillItineraries: new FindUphillItineraries(routingProvider),
    }),
    registerOpenApi: (registry) => {
      registerItinerariesOpenApi(registry, basePath);
    },
  };
}
