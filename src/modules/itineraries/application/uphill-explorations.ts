import type { Activity } from '../../../shared/domain/activity.ts';
import type { Position } from '../../../shared/domain/position.ts';
import { offset } from '../../../shared/domain/survey/geodesy.ts';
import {
  UPHILL_ROUND_TRIP_FACTOR,
  UPHILL_ROUND_TRIPS,
  UPHILL_SPOKE_BEARINGS,
  UPHILL_SPOKE_REACH,
} from '../domain/itinerary-rules.ts';
import type { RoutedPath, RoutingProvider } from '../domain/routing-provider.ts';

/** Where to look for a stretch going up, and for what. */
export interface UphillExploration {
  readonly start: Position;
  readonly radius: number;
  /** Length of the stretch wanted, in metres: sizes the round trips. */
  readonly length: number;
  readonly activity: Activity;
}

/**
 * Routing calls to try, in order, each worth one call of the budget: a few round trips
 * near the point, then ways heading out across the radius, where hills further away are.
 */
export function uphillExplorations(
  routing: RoutingProvider,
  { start, radius, length, activity }: UphillExploration,
): (() => Promise<RoutedPath | undefined>)[] {
  const roundTrips = Array.from(
    { length: UPHILL_ROUND_TRIPS },
    (_, index) => () =>
      routing.roundTrip(start, length * UPHILL_ROUND_TRIP_FACTOR, activity, index + 1),
  );
  const spokes = UPHILL_SPOKE_BEARINGS.map(
    (bearing) => () =>
      routing.routeTowards(start, offset(start, bearing, radius * UPHILL_SPOKE_REACH), activity),
  );
  return [...roundTrips, ...spokes];
}
