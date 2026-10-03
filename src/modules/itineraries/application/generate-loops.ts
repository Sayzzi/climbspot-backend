import {
  LOOP_ATTEMPTS_PER_BEARING,
  LOOP_BEARINGS,
  LOOP_LENGTH_TARGET,
  MAXIMUM_PROPOSALS,
  ROUTING_CALL_BUDGET,
} from '../domain/itinerary-rules.ts';
import type { LoopItinerary, LoopRequest } from '../domain/itinerary.ts';
import {
  fitsLength,
  initialLoopRadius,
  isSameLoop,
  loopWaypoints,
  rankLoops,
  toLoop,
} from '../domain/loop-search.ts';
import type { RoutingProvider } from '../domain/routing-provider.ts';
import { survey } from '../domain/surveyed-path.ts';

/**
 * Generates Loops from a point: routes through waypoints on a circle, at a few
 * bearings, rescaling the circle until the length fits (validated by the prototype).
 */
export class GenerateLoops {
  constructor(private readonly routing: RoutingProvider) {}

  async execute(request: LoopRequest): Promise<LoopItinerary[]> {
    const found: LoopItinerary[] = [];
    let calls = 0;

    for (const bearing of LOOP_BEARINGS) {
      let radius = initialLoopRadius(request.distance);

      for (
        let attempt = 0;
        attempt < LOOP_ATTEMPTS_PER_BEARING && calls < ROUTING_CALL_BUDGET;
        attempt += 1
      ) {
        calls += 1;
        const routed = await this.routing.routeThrough(
          loopWaypoints(request.start, bearing, radius),
          request.activity,
        );
        if (routed === undefined || routed.points.length < 2) {
          break;
        }
        // Judged on the path as measured, which is what the Visitor gets, never on
        // the routing service's own figure.
        const loop = toLoop(survey(routed), request);
        const { length } = loop.measurements;
        if (length <= 0) {
          break;
        }
        if (fitsLength(length, request.distance)) {
          if (!found.some((other) => isSameLoop(other, loop))) {
            found.push(loop);
          }
          break;
        }
        radius *= (request.distance * LOOP_LENGTH_TARGET) / length;
      }

      if (found.filter((loop) => loop.exact).length >= MAXIMUM_PROPOSALS) {
        break;
      }
    }

    return rankLoops(found, request).slice(0, MAXIMUM_PROPOSALS);
  }
}
