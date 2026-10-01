import { distanceBetween, interpolate } from './geodesy.ts';
import type { Position } from './position.ts';

/**
 * Returns positions every `spacing` metres along the path, always keeping its first
 * and last positions, so that measurements do not depend on how densely it was recorded.
 */
export function resample(path: readonly Position[], spacing: number): Position[] {
  const [first, ...rest] = path;
  if (first === undefined) {
    return [];
  }

  const resampled: Position[] = [first];
  let travelled = 0;
  let nextMark = spacing;
  let from = first;

  for (const to of rest) {
    const segment = distanceBetween(from, to);

    while (segment > 0 && travelled + segment >= nextMark) {
      resampled.push(interpolate(from, to, (nextMark - travelled) / segment));
      nextMark += spacing;
    }
    travelled += segment;
    from = to;
  }

  const lastResampled = resampled.at(-1) ?? first;
  if (distanceBetween(lastResampled, from) > spacing / 100) {
    resampled.push(from);
  }

  return resampled;
}
