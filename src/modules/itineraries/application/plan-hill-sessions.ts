import { SAMPLING_SPACING } from '../../../shared/domain/survey/survey-rules.ts';
import { toHillSession, rankHillSessions } from '../domain/hill-session.ts';
import { MAXIMUM_PROPOSALS, ROUTING_CALL_BUDGET } from '../domain/itinerary-rules.ts';
import type {
  HillSession,
  HillSessionRequest,
  UphillItinerary,
  UphillRequest,
} from '../domain/itinerary.ts';
import type { RoutingProvider } from '../domain/routing-provider.ts';
import { survey } from '../domain/surveyed-path.ts';
import {
  bestUphillStretch,
  isSameItinerary,
  trimmedTo,
  wallAbove,
} from '../domain/uphill-search.ts';
import { uphillExplorations } from './uphill-explorations.ts';

/**
 * Plans Hill Sessions from a point: explores like the Uphill search for a stretch a
 * little longer than a Repeat, cuts it to exactly the Repeat length where it goes up
 * most steadily, then routes the Warm-up of the best few; the Cool-down is its way back.
 */
export class PlanHillSessions {
  constructor(private readonly routing: RoutingProvider) {}

  async execute(request: HillSessionRequest): Promise<HillSession[]> {
    const uphill: UphillRequest = { ...request, length: request.repeatLength };
    // The shortest stretch covering the Repeat: samples lie every SAMPLING_SPACING metres.
    const lengths = {
      shortest: request.repeatLength,
      longest: request.repeatLength + SAMPLING_SPACING,
    };
    const candidates: UphillItinerary[] = [];

    // Keep calls for the Warm-ups of the sessions offered.
    const explorations = uphillExplorations(this.routing, uphill).slice(
      0,
      ROUTING_CALL_BUDGET - MAXIMUM_PROPOSALS,
    );
    for (const explore of explorations) {
      const routed = await explore();
      const stretch = routed && bestUphillStretch(survey(routed), uphill, lengths);
      if (stretch !== undefined) {
        keepBest(candidates, trimmedTo(stretch, request.repeatLength, uphill), request);
      }
      if (candidates.filter((candidate) => candidate.exact).length >= MAXIMUM_PROPOSALS) {
        break;
      }
    }

    const sessions: HillSession[] = [];
    for (const repeat of byPromise(candidates, request).slice(0, MAXIMUM_PROPOSALS)) {
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
function byPromise(candidates: readonly UphillItinerary[], request: HillSessionRequest) {
  return [...candidates].sort(
    (a, b) =>
      Number(b.exact) - Number(a.exact) ||
      wallAbove(a, request.maxGradient) - wallAbove(b, request.maxGradient) ||
      a.distanceToStart - b.distanceToStart,
  );
}

/** Adds a candidate, or replaces the same hill found earlier if this one is more promising. */
function keepBest(
  candidates: UphillItinerary[],
  candidate: UphillItinerary,
  request: HillSessionRequest,
) {
  const same = candidates.findIndex((existing) => isSameItinerary(existing, candidate));
  if (same === -1) {
    candidates.push(candidate);
    return;
  }
  const existing = candidates[same];
  if (existing !== undefined && byPromise([existing, candidate], request)[0] === candidate) {
    candidates[same] = candidate;
  }
}
