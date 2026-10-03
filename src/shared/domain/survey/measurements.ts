import { categoryFor, type Category } from './category.ts';
import { flatEquivalentDistance } from './effort.ts';
import { firstPoint, lastPoint, type ElevationProfile } from './elevation-profile.ts';
import { DIP_ALLOWANCE, DIP_ALLOWANCE_RATIO, MAXIMUM_GRADIENT_STRETCH } from './survey-rules.ts';

/** What is measured on a surveyed path, from its first to its last sample. */
export interface Measurements {
  /** Metres along the path. */
  readonly length: number;
  /** Last elevation minus first elevation, in metres. */
  readonly elevationGain: number;
  /** Every rise along the path, in metres (see CONTEXT.md). */
  readonly heightGained: number;
  /** Ratio: 0.08 means 8 %. */
  readonly averageGradient: number;
  /** Ratio, over the steepest stretch of at least MAXIMUM_GRADIENT_STRETCH metres. */
  readonly maximumGradient: number;
  /** Length in metres × average Gradient in percent, rounded to an integer (ADR 0006). */
  readonly difficultyScore: number;
  readonly category: Category;
  /** Metres on the flat costing a runner as much as the path (see CONTEXT.md). */
  readonly flatEquivalentDistance: number;
}

export function measure(profile: ElevationProfile): Measurements {
  const start = firstPoint(profile);
  const top = lastPoint(profile);
  const length = top.distance - start.distance;
  const elevationGain = top.elevation - start.elevation;
  const averageGradient = length > 0 ? elevationGain / length : 0;
  // Rounded before deriving the Category, so the two always agree.
  const difficultyScore = Math.round(length * averageGradient * 100);

  return {
    length,
    elevationGain,
    heightGained: heightGained(profile),
    averageGradient,
    maximumGradient: Math.max(averageGradient, steepestStretch(profile)),
    difficultyScore,
    category: categoryFor(difficultyScore),
    flatEquivalentDistance: flatEquivalentDistance(profile),
  };
}

/** Height Gained: the sum of every rise along the profile, in metres. */
export function heightGained(profile: ElevationProfile): number {
  return sumOfChanges(profile, (change) => Math.max(0, change));
}

/** The sum of every drop along the profile, in metres: the height lost in Dips. */
export function heightLost(profile: ElevationProfile): number {
  return sumOfChanges(profile, (change) => Math.max(0, -change));
}

/** Height a path going up may lose in Dips: the larger of a fixed allowance and a share of its gain. */
export function dipAllowance(elevationGain: number): number {
  return Math.max(DIP_ALLOWANCE, DIP_ALLOWANCE_RATIO * elevationGain);
}

function sumOfChanges(profile: ElevationProfile, count: (change: number) => number): number {
  let total = 0;
  for (const [index, point] of profile.entries()) {
    const previous = profile[index - 1];
    if (previous !== undefined) {
      total += count(point.elevation - previous.elevation);
    }
  }
  return total;
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
