import type { Activity } from '../../../shared/domain/activity.ts';
import { DomainError } from '../../../shared/domain/domain-error.ts';
import type { Position } from '../../../shared/domain/position.ts';

/** A point of a routed path with its terrain elevation, in metres. */
export interface RoutedPoint {
  readonly position: Position;
  readonly elevation: number;
}

/**
 * A path worked out over the road and trail network. Its length is measured on its
 * points, never taken from the routing service's own figure.
 */
export interface RoutedPath {
  readonly points: readonly RoutedPoint[];
}

/**
 * Works out paths over the road and trail network suited to an Activity (ADR 0008).
 * Each method answers `undefined` when no way can be found near the given positions.
 *
 * @throws {RoutingUnavailableError} when routing cannot be done right now.
 */
export interface RoutingProvider {
  /**
   * The way through these positions, in order. It begins and ends on ways next to the
   * first and last positions; the positions in between only steer it.
   */
  routeThrough(positions: readonly Position[], activity: Activity): Promise<RoutedPath | undefined>;
  /**
   * A way from next to `start` heading for `destination`, which only gives the
   * direction: the way ends wherever it gets near it.
   */
  routeTowards(
    start: Position,
    destination: Position,
    activity: Activity,
  ): Promise<RoutedPath | undefined>;
  /** A round trip of about `length` metres from `start`; each `variant` gives another one. */
  roundTrip(
    start: Position,
    length: number,
    activity: Activity,
    variant: number,
  ): Promise<RoutedPath | undefined>;
}

export class RoutingUnavailableError extends DomainError {
  readonly code = 'ROUTING_UNAVAILABLE';
  readonly kind = 'unavailable';
}
