import type { AscentPath } from '../../../shared/domain/ascent-times.ts';
import type { Bounds } from '../../../shared/domain/position.ts';

/** The Ascents of the catalogue, kept by another part of ClimbSpot. */
export interface AscentCatalogue {
  /** The Ascents whose Start lies within the box. */
  startingWithin(bounds: Bounds): Promise<AscentPath[]>;
}

/** A catalogue without any Ascent. */
export const emptyCatalogue: AscentCatalogue = { startingWithin: () => Promise.resolve([]) };
