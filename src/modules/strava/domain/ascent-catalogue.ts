import type { Position } from '../../../shared/domain/position.ts';

/** An Ascent of the catalogue, as far as Ascent Times need it. */
export interface CatalogueAscent {
  readonly id: string;
  /** From Start to Top. */
  readonly path: readonly Position[];
}

/** A latitude and longitude box. */
export interface Bounds {
  readonly south: number;
  readonly west: number;
  readonly north: number;
  readonly east: number;
}

/** The Ascents of the catalogue, kept by another part of ClimbSpot. */
export interface AscentCatalogue {
  /** The Ascents whose Start lies within the box. */
  startingWithin(bounds: Bounds): Promise<CatalogueAscent[]>;
}

/** A catalogue without any Ascent. */
export const emptyCatalogue: AscentCatalogue = { startingWithin: () => Promise.resolve([]) };
