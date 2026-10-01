import {
  AscentDipTooLargeError,
  AscentTooFlatError,
  AscentTooLongError,
  AscentTooLowError,
} from './ascent-errors.ts';
import {
  DIP_ALLOWANCE,
  DIP_ALLOWANCE_RATIO,
  MAXIMUM_LENGTH,
  MINIMUM_AVERAGE_GRADIENT,
  MINIMUM_ELEVATION_GAIN,
} from './ascent-rules.ts';
import type { AscentMeasurements } from './ascent.ts';
import type { ElevationProfile } from './elevation-profile.ts';
import { distanceBetween } from './geodesy.ts';
import type { Position } from './position.ts';

const percent = (ratio: number) => `${String(Math.round(ratio * 1000) / 10)} %`;
const metres = (value: number) => `${String(Math.round(value * 10) / 10)} m`;

/** Refuses paths too long to be an Ascent, before any elevation is fetched. */
export function ensureNotTooLong(path: readonly Position[]): void {
  let length = 0;
  for (const [index, position] of path.entries()) {
    const previous = path[index - 1];
    if (previous !== undefined) {
      length += distanceBetween(previous, position);
    }
  }

  if (length > MAXIMUM_LENGTH) {
    throw new AscentTooLongError(
      `The path is ${metres(length)} long; an Ascent is at most ${metres(MAXIMUM_LENGTH)}.`,
    );
  }
}

/** Refuses a measured profile that does not qualify as an Ascent (ADR 0006). */
export function ensureEligible(profile: ElevationProfile, measurements: AscentMeasurements): void {
  const { elevationGain, averageGradient } = measurements;

  if (elevationGain < MINIMUM_ELEVATION_GAIN) {
    throw new AscentTooLowError(
      `The path gains ${metres(elevationGain)}; an Ascent gains at least ${metres(MINIMUM_ELEVATION_GAIN)}.`,
    );
  }

  if (averageGradient < MINIMUM_AVERAGE_GRADIENT) {
    throw new AscentTooFlatError(
      `The path averages ${percent(averageGradient)}; an Ascent averages at least ${percent(MINIMUM_AVERAGE_GRADIENT)}.`,
    );
  }

  const lost = heightLostInDips(profile);
  const allowance = Math.max(DIP_ALLOWANCE, DIP_ALLOWANCE_RATIO * elevationGain);
  if (lost > allowance) {
    throw new AscentDipTooLargeError(
      `The path loses ${metres(lost)} in Dips; at most ${metres(allowance)} is allowed. Split it into two Ascents.`,
    );
  }
}

function heightLostInDips(profile: ElevationProfile): number {
  let lost = 0;
  for (const [index, point] of profile.entries()) {
    const previous = profile[index - 1];
    if (previous !== undefined && point.elevation < previous.elevation) {
      lost += previous.elevation - point.elevation;
    }
  }
  return lost;
}
