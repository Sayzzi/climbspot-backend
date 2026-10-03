import { ensureEligible } from './ascent-eligibility.ts';
import {
  firstPoint,
  lastPoint,
  reverse,
  type ElevationProfile,
  type ProfilePoint,
} from '../../../shared/domain/survey/elevation-profile.ts';
import type { Position } from '../../../shared/domain/position.ts';
import { measure, type Measurements } from '../../../shared/domain/survey/measurements.ts';
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
  readonly measurements: Measurements;
  /** The signed-in Visitor who added it, if known; never shown to others. */
  readonly contributorId: string | undefined;
  readonly createdAt: Date;
}

/** An Ascent without its path and Elevation Profile, e.g. in search results. */
export interface AscentSummary {
  readonly id: string;
  readonly name: string;
  readonly surface: Surface;
  readonly start: AscentPoint;
  readonly top: AscentPoint;
  readonly measurements: Measurements;
  readonly createdAt: Date;
}

/** The Start or the Top of an Ascent. */
export interface AscentPoint {
  readonly position: Position;
  /** Metres. */
  readonly elevation: number;
}

export interface NewAscent {
  readonly id: string;
  readonly name: string;
  readonly surface: Surface;
  /** Path and profile in the direction they were provided; both are turned uphill if needed. */
  readonly path: readonly Position[];
  readonly profile: ElevationProfile;
  readonly contributorId: string;
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
  const { path: _path, profile: _profile, contributorId: _contributor, ...identity } = ascent;
  const toPoint = ({ position, elevation }: ProfilePoint): AscentPoint => ({ position, elevation });

  return { ...identity, start: toPoint(startOf(ascent)), top: toPoint(topOf(ascent)) };
}

function isUphill(profile: ElevationProfile): boolean {
  return lastPoint(profile).elevation >= firstPoint(profile).elevation;
}
