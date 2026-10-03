import { exactThenSteady, rankHillSessions, toHillSession } from '../domain/hill-session.ts';
import { MAXIMUM_PROPOSALS, ROUTING_CALL_BUDGET } from '../domain/itinerary-rules.ts';
import type {
  HillSession,
  HillSessionRequest,
  UphillItinerary,
  UphillRequest,
} from '../domain/itinerary.ts';
import type { RoutingProvider } from '../domain/routing-provider.ts';
import { survey } from '../domain/surveyed-path.ts';
import { bestUphillStretch, keepBest } from '../domain/uphill-search.ts';
import { uphillExplorations } from './uphill-explorations.ts';

/**
 * Plans Hill Sessions from a point: explores like the Uphill search for a stretch of
 * exactly the Repeat length where a hill goes up most steadily, then routes the Warm-up
 * of the most promising few; the Cool-down is its way back.
 */
export class PlanHillSessions {
  constructor(private readonly routing: RoutingProvider) {}

  async execute(request: HillSessionRequest): Promise<HillSession[]> {
    const uphill: UphillRequest = { ...request, length: request.repeatLength };
    const exactly = { shortest: request.repeatLength, longest: request.repeatLength };
    const promising = mostPromising(request);
    const candidates: UphillItinerary[] = [];

    // Keep calls for the Warm-ups of the sessions offered.
    const explorations = uphillExplorations(this.routing, uphill).slice(
      0,
      ROUTING_CALL_BUDGET - MAXIMUM_PROPOSALS,
    );
    for (const explore of explorations) {
      const routed = await explore();
      const repeat = routed && bestUphillStretch(survey(routed), uphill, exactly);
      if (repeat !== undefined) {
        keepBest(candidates, repeat, (a, b) => promising(a, b) < 0);
      }
      if (candidates.filter((candidate) => candidate.exact).length >= MAXIMUM_PROPOSALS) {
        break;
      }
    }

    const sessions: HillSession[] = [];
    for (const repeat of [...candidates].sort(promising).slice(0, MAXIMUM_PROPOSALS)) {
      const foot = repeat.path[0];
      const warmUp =
        foot && (await this.routing.routeThrough([request.start, foot], request.activity));
      if (warmUp && warmUp.points.length >= 2) {
        sessions.push(toHillSession(repeat, survey(warmUp), request.repeats));
      }
    }

    return rankHillSessions(sessions, request.maxGradient);
  }
}

/** Before Warm-ups are routed: exact, steady, then nearest as the crow flies. */
const mostPromising =
  (request: HillSessionRequest) =>
  (a: UphillItinerary, b: UphillItinerary): number =>
    exactThenSteady(request.maxGradient)(a, b) || a.distanceToStart - b.distanceToStart;
