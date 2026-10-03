import { bearingBetween, distanceBetween, offset } from '../../../shared/domain/survey/geodesy.ts';
import type { Position } from '../../../shared/domain/position.ts';
import {
  LENGTH_TOLERANCE,
  LOOP_ATTEMPTS_PER_BEARING,
  LOOP_BEARINGS,
  LOOP_LENGTH_TARGET,
  LOOP_MINIMUM_WIDTH,
  LOOP_SURVEY_BEARINGS,
  LOOP_SURVEY_REACH,
  MAXIMUM_PROPOSALS,
  ROUTING_CALL_BUDGET,
} from '../domain/itinerary-rules.ts';
import type { LoopItinerary, LoopRequest } from '../domain/itinerary.ts';
import {
  fitsLength,
  highPoints,
  initialLoopRadius,
  isSameLoop,
  loopWaypoints,
  rankLoops,
  stretchedLoopWaypoints,
  toLoop,
} from '../domain/loop-search.ts';
import type { RoutingProvider } from '../domain/routing-provider.ts';
import { survey, type SurveyedPath } from '../domain/surveyed-path.ts';

/**
 * Generates Loops from a point: routes through waypoints on a circle, at a few
 * bearings, rescaling the circle until the length fits (validated by the prototype).
 * When those Loops lack the asked Relief, it surveys the terrain within reach and
 * stretches Loops out to its highest points.
 */
export class GenerateLoops {
  constructor(private readonly routing: RoutingProvider) {}

  async execute(request: LoopRequest): Promise<LoopItinerary[]> {
    const search = new LoopSearch(this.routing, request);

    // The ways wind about as much in every direction: each bearing starts from the
    // radius that last fitted, saving a rescaling call.
    let radius = initialLoopRadius(request.distance);
    for (const bearing of LOOP_BEARINGS) {
      if (search.isDone()) break;
      radius =
        (await search.fit((size) => loopWaypoints(request.start, bearing, size), radius)) ?? radius;
    }

    if (request.relief !== 'flat' && !search.isDone()) {
      const reach = request.distance * LOOP_SURVEY_REACH;
      for (const bearing of LOOP_SURVEY_BEARINGS) {
        if (search.isDone()) break;
        await search.surveyTowards(offset(request.start, bearing, reach));
      }
      for (const point of highPoints(search.surveyed, request.start, reach)) {
        if (search.isDone()) break;
        const bearing = bearingBetween(request.start, point);
        const distance = distanceBetween(request.start, point);
        await search.fit(
          (width) => stretchedLoopWaypoints(request.start, bearing, distance, width),
          distance / 2,
          distance * LOOP_MINIMUM_WIDTH,
        );
      }
    }

    return rankLoops(search.found, request).slice(0, MAXIMUM_PROPOSALS);
  }
}

/** The routing calls of one Loop request, within budget, and what they found. */
class LoopSearch {
  readonly found: LoopItinerary[] = [];
  readonly surveyed: SurveyedPath[] = [];
  private calls = 0;

  constructor(
    private readonly routing: RoutingProvider,
    private readonly request: LoopRequest,
  ) {}

  isDone(): boolean {
    return (
      this.calls >= ROUTING_CALL_BUDGET ||
      this.found.filter((loop) => loop.exact).length >= MAXIMUM_PROPOSALS
    );
  }

  /**
   * Rescales a shape until the Loop it gives fits the asked distance; answers the
   * size that fitted, if any. Judged on the path as measured, which is what the
   * Visitor gets, never on the routing service's own figure.
   */
  async fit(
    shape: (size: number) => Position[],
    initialSize: number,
    minimumSize = 0,
  ): Promise<number | undefined> {
    let size = initialSize;
    for (let attempt = 0; attempt < LOOP_ATTEMPTS_PER_BEARING; attempt += 1) {
      if (this.calls >= ROUTING_CALL_BUDGET || size < minimumSize) return undefined;
      this.calls += 1;
      const routed = await this.routing.routeThrough(shape(size), this.request.activity);
      if (routed === undefined || routed.points.length < 2) return undefined;
      const surveyed = survey(routed);
      this.surveyed.push(surveyed);
      const loop = toLoop(surveyed, this.request);
      const { length } = loop.measurements;
      if (length <= 0) return undefined;
      if (fitsLength(length, this.request.distance)) {
        if (!this.found.some((other) => isSameLoop(other, loop))) {
          this.found.push(loop);
        }
        return size;
      }
      // Too long even at the smallest size: the shape cannot fit.
      if (length > this.request.distance * (1 + LENGTH_TOLERANCE) && size === minimumSize) {
        return undefined;
      }
      size = Math.max(minimumSize, (size * this.request.distance * LOOP_LENGTH_TARGET) / length);
    }
    return undefined;
  }

  /** Routes towards a destination only to learn the terrain on the way. */
  async surveyTowards(destination: Position): Promise<void> {
    this.calls += 1;
    const routed = await this.routing.routeTowards(
      this.request.start,
      destination,
      this.request.activity,
    );
    if (routed !== undefined && routed.points.length >= 2) {
      this.surveyed.push(survey(routed));
    }
  }
}
