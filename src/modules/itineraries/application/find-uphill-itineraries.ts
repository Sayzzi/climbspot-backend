import { MAXIMUM_PROPOSALS, ROUTING_CALL_BUDGET } from '../domain/itinerary-rules.ts';
import type { UphillItinerary, UphillRequest } from '../domain/itinerary.ts';
import type { RoutingProvider } from '../domain/routing-provider.ts';
import { survey } from '../domain/surveyed-path.ts';
import { bestUphillStretch, keepBest, rankUphill } from '../domain/uphill-search.ts';
import { uphillExplorations } from './uphill-explorations.ts';

/**
 * Finds Uphill Itineraries near a point: explores a few round trips around it, then
 * ways heading out across the radius, and keeps the best stretch going up in each
 * (validated by the feasibility prototype).
 */
export class FindUphillItineraries {
  constructor(private readonly routing: RoutingProvider) {}

  async execute(request: UphillRequest): Promise<UphillItinerary[]> {
    const found: UphillItinerary[] = [];

    for (const explore of uphillExplorations(this.routing, request).slice(0, ROUTING_CALL_BUDGET)) {
      const routed = await explore();
      const stretch = routed && bestUphillStretch(survey(routed), request);
      if (stretch !== undefined) {
        keepBest(found, stretch, (a, b) => rankUphill([b, a], request)[0] === a);
      }
      if (found.filter((itinerary) => itinerary.exact).length >= MAXIMUM_PROPOSALS) {
        break;
      }
    }

    return rankUphill(found, request).slice(0, MAXIMUM_PROPOSALS);
  }
}
