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
  /** From Start to Top. */
  readonly profile: ElevationProfile;
  readonly measurements: AscentMeasurements;
  readonly createdAt: Date;
}

/** An Ascent without its path and Elevation Profile, e.g. in search results. */
export interface AscentSummary {
  readonly id: string;
  readonly name: string;
  readonly surface: Surface;
  readonly start: AscentEnd;
  readonly top: AscentEnd;
  readonly measurements: AscentMeasurements;
  readonly createdAt: Date;
}

/** Start or Top of an Ascent. */
export interface AscentEnd {
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
  /** Length in metres × average Gradient in percent (ADR 0006). */
  readonly difficultyScore: number;
  readonly category: Category;
}

export interface NewAscent {
  readonly id: string;
  readonly name: string;
  readonly surface: Surface;
  /** In the direction it was provided; it is turned uphill if needed. */
  readonly profile: ElevationProfile;
  readonly createdAt: Date;
}

/**
 * Turns a surveyed path into an Ascent.
 *
 * @throws when the path does not qualify as an Ascent (see `ensureEligible`).
 */
export function createAscent({ profile, ...identity }: NewAscent): Ascent {
  const uphill = isUphill(profile) ? profile : reverse(profile);
  const measurements = measure(uphill);
  ensureEligible(uphill, measurements);
  return { ...identity, profile: uphill, measurements };
}

export function startOf(ascent: Ascent): ProfilePoint {
  return firstPoint(ascent.profile);
}

export function topOf(ascent: Ascent): ProfilePoint {
  return lastPoint(ascent.profile);
}

export function summarize({ profile, ...ascent }: Ascent): AscentSummary {
  const { position: startPosition, elevation: startElevation } = firstPoint(profile);
  const { position: topPosition, elevation: topElevation } = lastPoint(profile);

  return {
    ...ascent,
    start: { position: startPosition, elevation: startElevation },
    top: { position: topPosition, elevation: topElevation },
  };
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
  const difficultyScore = length * averageGradient * 100;

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
