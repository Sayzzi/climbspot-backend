import { distanceBetween, interpolate } from './geodesy.ts';
import type { Position } from './position.ts';

/** A position on a path, with its distance from the path's first position. */
export interface Sample {
  readonly position: Position;
  /** Metres along the path (not in a straight line). */
  readonly distance: number;
}

/**
 * Returns positions every `spacing` metres along the path, always keeping its first
 * and last positions, so that measurements do not depend on how densely it was recorded.
 * Distances are measured along the path, so corners between samples keep their length.
 */
export function resample(path: readonly Position[], spacing: number): Sample[] {
  const [first, ...rest] = path;
  if (first === undefined) {
    return [];
  }

  const samples: Sample[] = [{ position: first, distance: 0 }];
  let travelled = 0;
  let nextMark = spacing;
  let from = first;

  for (const to of rest) {
    const segment = distanceBetween(from, to);

    while (segment > 0 && travelled + segment >= nextMark) {
      samples.push({
        position: interpolate(from, to, (nextMark - travelled) / segment),
        distance: nextMark,
      });
      nextMark += spacing;
    }
    travelled += segment;
    from = to;
  }

  const last = samples.at(-1) ?? samples[0];
  if (last !== undefined && travelled - last.distance > spacing / 100) {
    samples.push({ position: from, distance: travelled });
  }

  return samples;
}

/**
 * Drops the positions that change the path's shape by less than `tolerance` metres
 * (Douglas-Peucker), keeping its first and last positions.
 */
export function simplify(path: readonly Position[], tolerance: number): Position[] {
  const [first] = path;
  if (first === undefined || path.length < 3) {
    return [...path];
  }

  // Local flat projection in metres around the first position: precise enough for an Ascent.
  const metresPerDegreeOfLatitude = 111_195;
  const metresPerDegreeOfLongitude =
    metresPerDegreeOfLatitude * Math.cos((first.latitude * Math.PI) / 180);
  const points = path.map(({ latitude, longitude }) => ({
    x: (longitude - first.longitude) * metresPerDegreeOfLongitude,
    y: (latitude - first.latitude) * metresPerDegreeOfLatitude,
  }));

  const keep = new Array<boolean>(path.length).fill(false);
  keep[0] = true;
  keep[path.length - 1] = true;
  const stack: [number, number][] = [[0, path.length - 1]];

  for (let range = stack.pop(); range !== undefined; range = stack.pop()) {
    const [start, end] = range;
    const a = points[start];
    const b = points[end];
    if (a === undefined || b === undefined) {
      continue;
    }
    let farthest = -1;
    let farthestDistance = tolerance;
    for (let index = start + 1; index < end; index += 1) {
      const p = points[index];
      if (p !== undefined) {
        const offset = distanceToSegment(p, a, b);
        if (offset > farthestDistance) {
          farthest = index;
          farthestDistance = offset;
        }
      }
    }
    if (farthest !== -1) {
      keep[farthest] = true;
      stack.push([start, farthest], [farthest, end]);
    }
  }

  return path.filter((_, index) => keep[index]);
}

interface Point {
  readonly x: number;
  readonly y: number;
}

function distanceToSegment(p: Point, a: Point, b: Point): number {
  const [dx, dy] = [b.x - a.x, b.y - a.y];
  const lengthSquared = dx * dx + dy * dy;
  const t =
    lengthSquared === 0
      ? 0
      : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSquared));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}
