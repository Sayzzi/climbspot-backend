import { offset } from '../../../shared/domain/survey/geodesy.ts';
import {
  MAXIMUM_PROPOSALS,
  ROUTING_CALL_BUDGET,
  UPHILL_ROUND_TRIP_FACTOR,
  UPHILL_ROUND_TRIPS,
  UPHILL_SPOKE_BEARINGS,
  UPHILL_SPOKE_REACH,
} from '../domain/itinerary-rules.ts';
import type { UphillItinerary, UphillRequest } from '../domain/itinerary.ts';
import type { RoutedPath, RoutingProvider } from '../domain/routing-provider.ts';
import { survey } from '../domain/surveyed-path.ts';
import { bestUphillStretch, isSameItinerary, rankUphill } from '../domain/uphill-search.ts';

/**
 * Finds Uphill Itineraries near a point: explores a few round trips around it, then
 * ways heading out across the radius, and keeps the best stretch going up in each
 * (validated by the feasibility prototype).
 */
export class FindUphillItineraries {
  constructor(private readonly routing: RoutingProvider) {}

  async execute(request: UphillRequest): Promise<UphillItinerary[]> {
    const found: UphillItinerary[] = [];

    for (const explore of this.explorations(request).slice(0, ROUTING_CALL_BUDGET)) {
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

  /** Routing calls to try, in order, each worth one call of the budget. */
  private explorations(request: UphillRequest): (() => Promise<RoutedPath | undefined>)[] {
    const roundTrips = Array.from(
      { length: UPHILL_ROUND_TRIPS },
      (_, index) => () =>
        this.routing.roundTrip(
          request.start,
          request.length * UPHILL_ROUND_TRIP_FACTOR,
          request.activity,
          index + 1,
        ),
    );
    const spokes = UPHILL_SPOKE_BEARINGS.map(
      (bearing) => () =>
        this.routing.routeThrough(
          [request.start, offset(request.start, bearing, request.radius * UPHILL_SPOKE_REACH)],
          request.activity,
        ),
    );
    return [...roundTrips, ...spokes];
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
