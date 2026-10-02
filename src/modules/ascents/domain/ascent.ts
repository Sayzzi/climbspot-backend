import { ensureEligible } from './ascent-eligibility.ts';
import { MAXIMUM_GRADIENT_STRETCH } from './ascent-rules.ts';
import { categoryFor, type Category } from './category.ts';
import {
  firstPoint,
  lastPoint,
  reverse,
  type ElevationProfile,
  type ProfilePoint,
} from './elevation-profile.ts';
import type { Position } from './position.ts';
import type { Surface } from './surface.ts';

/** A one-way uphill path from a Start to a Top (see CONTEXT.md). */
export interface Ascent {
  readonly id: string;
  readonly name: string;
  readonly surface: Surface;
  /** Shape of the Ascent for maps, from Start to Top, simplified from the uploaded path. */
  readonly path: readonly Position[];
  /** Samples every SAMPLING_SPACING metres, from Start to Top: what is measured. */
  readonly profile: ElevationProfile;
  readonly measurements: AscentMeasurements;
  readonly createdAt: Date;
}

/** An Ascent without its path and Elevation Profile, e.g. in search results. */
export interface AscentSummary {
  readonly id: string;
  readonly name: string;
  readonly surface: Surface;
  readonly start: AscentPoint;
  readonly top: AscentPoint;
  readonly measurements: AscentMeasurements;
  readonly createdAt: Date;
}

/** The Start or the Top of an Ascent. */
export interface AscentPoint {
  readonly position: Position;
  /** Metres. */
  readonly elevation: number;
}

export interface AscentMeasurements {
  /** Metres along the path. */
  readonly length: number;
  /** Top minus Start, in metres. */
  readonly elevationGain: number;
  /** Ratio: 0.08 means 8 %. */
  readonly averageGradient: number;
  /** Ratio, over the steepest stretch of at least MAXIMUM_GRADIENT_STRETCH metres. */
  readonly maximumGradient: number;
  /** Length in metres × average Gradient in percent, rounded to an integer (ADR 0006). */
  readonly difficultyScore: number;
  readonly category: Category;
}

export interface NewAscent {
  readonly id: string;
  readonly name: string;
  readonly surface: Surface;
  /** Path and profile in the direction they were provided; both are turned uphill if needed. */
  readonly path: readonly Position[];
  readonly profile: ElevationProfile;
  readonly createdAt: Date;
}

/**
 * Turns a surveyed path into an Ascent.
 *
 * @throws when the path does not qualify as an Ascent (see `ensureEligible`).
 */
export function createAscent({ path, profile, ...identity }: NewAscent): Ascent {
  const goesUp = isUphill(profile);
  const uphill = goesUp ? profile : reverse(profile);
  const measurements = measure(uphill);
  ensureEligible(uphill, measurements);
  return { ...identity, path: goesUp ? path : path.toReversed(), profile: uphill, measurements };
}

export function startOf(ascent: Ascent): ProfilePoint {
  return firstPoint(ascent.profile);
}

export function topOf(ascent: Ascent): ProfilePoint {
  return lastPoint(ascent.profile);
}

export function summarize(ascent: Ascent): AscentSummary {
  const { path: _path, profile: _profile, ...identity } = ascent;
  const toPoint = ({ position, elevation }: ProfilePoint): AscentPoint => ({ position, elevation });

  return { ...identity, start: toPoint(startOf(ascent)), top: toPoint(topOf(ascent)) };
}

function isUphill(profile: ElevationProfile): boolean {
  return lastPoint(profile).elevation >= firstPoint(profile).elevation;
}

function measure(profile: ElevationProfile): AscentMeasurements {
  const start = firstPoint(profile);
  const top = lastPoint(profile);
  const length = top.distance;
  const elevationGain = top.elevation - start.elevation;
  const averageGradient = length > 0 ? elevationGain / length : 0;
  // Rounded before deriving the Category, so the two always agree.
  const difficultyScore = Math.round(length * averageGradient * 100);

  return {
    length,
    elevationGain,
    averageGradient,
    maximumGradient: Math.max(averageGradient, steepestStretch(profile)),
    difficultyScore,
    category: categoryFor(difficultyScore),
  };
}

/** Steepest Gradient over any stretch of at least MAXIMUM_GRADIENT_STRETCH metres. */
function steepestStretch(profile: ElevationProfile): number {
  let steepest = Number.NEGATIVE_INFINITY;
  let end = 0;

  for (const [index, from] of profile.entries()) {
    end = Math.max(end, index + 1);
    let to = profile[end];
    while (to !== undefined && to.distance - from.distance < MAXIMUM_GRADIENT_STRETCH) {
      end += 1;
      to = profile[end];
    }
    if (to === undefined) {
      break;
    }
    steepest = Math.max(steepest, (to.elevation - from.elevation) / (to.distance - from.distance));
  }

  return steepest;
}
