import type { Position } from '../../../shared/domain/position.ts';
import {
  buildProfile,
  smooth,
  type ElevationProfile,
} from '../../../shared/domain/survey/elevation-profile.ts';
import { distanceBetween, interpolate } from '../../../shared/domain/survey/geodesy.ts';
import { resample } from '../../../shared/domain/survey/path.ts';
import { SAMPLING_SPACING, SMOOTHING_WINDOW } from '../../../shared/domain/survey/survey-rules.ts';
import type { RoutedPath, RoutedPoint } from './routing-provider.ts';

/** A routed path surveyed like an Ascent, keeping its full geometry for maps. */
export interface SurveyedPath {
  readonly profile: ElevationProfile;
  readonly geometry: readonly Position[];
  /** Distance of each geometry point along the path, in metres. */
  readonly distances: readonly number[];
}

/** Samples every SAMPLING_SPACING metres, elevations interpolated from the routed points, smoothed. */
export function survey(routed: RoutedPath): SurveyedPath {
  const geometry = routed.points.map((point) => point.position);
  const distances = cumulativeDistances(geometry);
  const samples = resample(geometry, SAMPLING_SPACING);
  const elevations = smooth(
    samples.map((sample) => elevationAlong(routed.points, distances, sample.distance)),
    SMOOTHING_WINDOW,
  );
  return { profile: buildProfile(samples, elevations), geometry, distances };
}

/** The geometry between two distances along the path, ends interpolated. */
export function geometryBetween(path: SurveyedPath, from: number, to: number): Position[] {
  const inner = path.geometry.filter((_, index) => {
    const distance = path.distances[index] ?? Number.NaN;
    return distance > from && distance < to;
  });
  return [positionAlong(path, from), ...inner, positionAlong(path, to)];
}

function cumulativeDistances(geometry: readonly Position[]): number[] {
  let total = 0;
  return geometry.map((position, index) => {
    const previous = geometry[index - 1];
    if (previous !== undefined) {
      total += distanceBetween(previous, position);
    }
    return total;
  });
}

/** Index of the segment containing `distance`, and how far along it (0–1). */
function locate(distances: readonly number[], distance: number): [number, number] {
  let index = 0;
  while (index < distances.length - 2 && (distances[index + 1] ?? Infinity) < distance) {
    index += 1;
  }
  const from = distances[index] ?? 0;
  const to = distances[index + 1] ?? from;
  return [index, to > from ? Math.min(1, Math.max(0, (distance - from) / (to - from))) : 0];
}

function elevationAlong(
  points: readonly RoutedPoint[],
  distances: readonly number[],
  distance: number,
): number {
  const [index, fraction] = locate(distances, distance);
  const from = points[index]?.elevation ?? 0;
  const to = points[index + 1]?.elevation ?? from;
  return from + (to - from) * fraction;
}

function positionAlong(path: SurveyedPath, distance: number): Position {
  const [index, fraction] = locate(path.distances, distance);
  const from = path.geometry[index];
  const to = path.geometry[index + 1] ?? from;
  if (from === undefined || to === undefined) {
    throw new RangeError('A surveyed path has at least one point.');
  }
  return interpolate(from, to, fraction);
}
