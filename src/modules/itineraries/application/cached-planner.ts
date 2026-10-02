import type { Position } from '../../../shared/domain/position.ts';
import {
  PLANNING_CACHE_SIZE,
  PLANNING_CACHE_TTL,
  PLANNING_POINT_DECIMALS,
} from '../domain/itinerary-rules.ts';

/** Anything that plans Itineraries for a request. */
export interface Planner<Request, Result> {
  execute(request: Request): Promise<Result>;
}

interface Entry<Result> {
  readonly expires: number;
  readonly result: Promise<Result>;
}

/**
 * Answers identical requests from memory for PLANNING_CACHE_TTL, so that the routing
 * quota lasts (ADR 0008). Concurrent identical requests share one planning; failures
 * are not remembered.
 */
export class CachedPlanner<Request extends { readonly start: Position }, Result> implements Planner<
  Request,
  Result
> {
  private readonly entries = new Map<string, Entry<Result>>();

  constructor(
    private readonly planner: Planner<Request, Result>,
    private readonly now: () => number,
  ) {}

  async execute(request: Request): Promise<Result> {
    const key = keyOf(request);
    const cached = this.entries.get(key);
    if (cached !== undefined && cached.expires > this.now()) {
      return cached.result;
    }

    const result = this.planner.execute(request);
    this.remember(key, { expires: this.now() + PLANNING_CACHE_TTL, result });
    try {
      return await result;
    } catch (error) {
      this.entries.delete(key);
      throw error;
    }
  }

  private remember(key: string, entry: Entry<Result>) {
    this.entries.delete(key);
    this.entries.set(key, entry);
    // Maps keep insertion order: the first key is the oldest.
    for (const oldest of this.entries.keys()) {
      if (this.entries.size <= PLANNING_CACHE_SIZE) break;
      this.entries.delete(oldest);
    }
  }
}

/** The request with its point rounded to ~10 m, every other field as is. */
function keyOf({ start, ...rest }: { readonly start: Position }): string {
  const round = (degrees: number) => degrees.toFixed(PLANNING_POINT_DECIMALS);
  return JSON.stringify({ start: [round(start.latitude), round(start.longitude)], ...rest });
}
