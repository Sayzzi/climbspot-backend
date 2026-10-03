import type { Activity } from '../../../shared/domain/activity.ts';
import type { Position } from '../../../shared/domain/position.ts';
import type { ElevationProfile } from '../../../shared/domain/survey/elevation-profile.ts';
import type { Measurements } from '../../../shared/domain/survey/measurements.ts';

/** How a close proposal differs from what the Visitor asked for. */
export type Difference =
  | {
      readonly kind: 'gradient';
      readonly min: number;
      readonly max: number;
      readonly actual: number;
    }
  | { readonly kind: 'relief'; readonly wanted: Relief; readonly actual: Relief };

export const reliefs = ['flat', 'rolling', 'hilly'] as const;

export type Relief = (typeof reliefs)[number];

/** What every Itinerary has, whatever its kind. */
interface ItineraryBase {
  /** Routed geometry for maps, in the direction it is travelled. */
  readonly path: readonly Position[];
  /** Samples every SAMPLING_SPACING metres, distances from the beginning. */
  readonly profile: ElevationProfile;
  readonly measurements: Measurements;
  /** True when it matches the request; otherwise `differences` say how it does not. */
  readonly exact: boolean;
  readonly differences: readonly Difference[];
}

export interface UphillItinerary extends ItineraryBase {
  readonly kind: 'uphill';
  /** Metres from the Visitor's point to where the Itinerary starts. */
  readonly distanceToStart: number;
}

export interface LoopItinerary extends ItineraryBase {
  readonly kind: 'loop';
  readonly relief: Relief;
}

export interface LoopRequest {
  readonly start: Position;
  /** Metres; the Loop is never shorter and at most LENGTH_TOLERANCE longer. */
  readonly distance: number;
  readonly relief: Relief;
  readonly activity: Activity;
}

export interface UphillRequest {
  readonly start: Position;
  /** Metres from `start` within which the Itinerary must start. */
  readonly radius: number;
  /** Metres; the Itinerary is never shorter and at most LENGTH_TOLERANCE longer. */
  readonly length: number;
  /** Average Gradient range, as ratios. */
  readonly minGradient: number;
  readonly maxGradient: number;
  readonly activity: Activity;
}
