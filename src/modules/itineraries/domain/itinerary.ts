import type { Activity, RunningActivity } from '../../../shared/domain/activity.ts';
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

export interface HillSessionRequest {
  readonly start: Position;
  /** Metres from `start` within which the Repeats must start. */
  readonly radius: number;
  readonly repeats: number;
  /** Metres; every Repeat is exactly this long. */
  readonly repeatLength: number;
  /** Average Gradient range of the Repeat, as ratios. */
  readonly minGradient: number;
  readonly maxGradient: number;
  readonly activity: RunningActivity;
}

/** A Hill Session (see CONTEXT.md): Warm-up, Repeats and Recoveries, Cool-down. */
export interface HillSession {
  readonly kind: 'session';
  readonly repeats: number;
  /** The Uphill Itinerary run up for each Repeat, exactly the asked length. */
  readonly repeat: UphillItinerary;
  /** From the starting point to the foot of the Repeat; the Cool-down is its way back. */
  readonly warmUp: {
    readonly path: readonly Position[];
    readonly profile: ElevationProfile;
  };
  /** Measured over the whole session: Warm-up, Repeats and Recoveries, Cool-down. */
  readonly measurements: Measurements;
  readonly exact: boolean;
  readonly differences: readonly Difference[];
}
