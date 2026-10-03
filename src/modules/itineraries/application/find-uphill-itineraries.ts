import { MAXIMUM_PROPOSALS, ROUTING_CALL_BUDGET } from '../domain/itinerary-rules.ts';
import type { UphillItinerary, UphillRequest } from '../domain/itinerary.ts';
import type { RoutingProvider } from '../domain/routing-provider.ts';
import { survey } from '../domain/surveyed-path.ts';
import { bestUphillStretch, isSameItinerary, rankUphill } from '../domain/uphill-search.ts';
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
        keepBest(found, stretch, request);
      }
      if (found.filter((itinerary) => itinerary.exact).length >= MAXIMUM_PROPOSALS) {
        break;
      }
    }

    return rankUphill(found, request).slice(0, MAXIMUM_PROPOSALS);
  }
}

/** Adds a proposal, or replaces the same stretch found earlier if this one ranks better. */
function keepBest(found: UphillItinerary[], candidate: UphillItinerary, request: UphillRequest) {
  const same = found.findIndex((itinerary) => isSameItinerary(itinerary, candidate));
  if (same === -1) {
    found.push(candidate);
    return;
  }
  const existing = found[same];
  if (existing !== undefined && rankUphill([existing, candidate], request)[0] === candidate) {
    found[same] = candidate;
  }
}
