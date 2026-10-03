import type { ElevationProfile } from './elevation-profile.ts';
import { DESCENT_COST_FLOOR, EFFORT_GRADIENT_LIMIT } from './survey-rules.ts';

/** Minetti's energy cost of running at a Gradient (a ratio), in J/kg/m. */
function costOfRunning(gradient: number): number {
  const i = Math.max(-EFFORT_GRADIENT_LIMIT, Math.min(EFFORT_GRADIENT_LIMIT, gradient));
  return 155.4 * i ** 5 - 30.4 * i ** 4 - 43.3 * i ** 3 + 46.3 * i ** 2 + 19.5 * i + 3.6;
}

const FLAT_COST = costOfRunning(0);

/**
 * The distance on the flat that costs a runner as much as the profile, stretch by
 * stretch between its samples (see CONTEXT.md), in metres.
 */
export function flatEquivalentDistance(profile: ElevationProfile): number {
  let total = 0;
  for (const [index, to] of profile.entries()) {
    const from = profile[index - 1];
    const length = from === undefined ? 0 : to.distance - from.distance;
    if (from !== undefined && length > 0) {
      const cost = costOfRunning((to.elevation - from.elevation) / length) / FLAT_COST;
      total += length * Math.max(DESCENT_COST_FLOOR, cost);
    }
  }
  return total;
}

/** Km-Effort: the length in kilometres plus one per 100 m of Height Gained. */
export function kmEffort(length: number, heightGained: number): number {
  return length / 1000 + heightGained / 100;
}
