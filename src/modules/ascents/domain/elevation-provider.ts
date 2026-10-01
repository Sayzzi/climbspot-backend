import { DomainError } from '../../../shared/domain/domain-error.ts';
import type { Position } from './position.ts';

export type { Position };

/** Source of terrain elevations (ADR 0005). */
export interface ElevationProvider {
  /**
   * Returns the terrain elevation in metres of each position, in the same order.
   *
   * @throws {ElevationUnavailableError} when the elevations cannot be obtained right now.
   */
  elevationsAt(positions: readonly Position[]): Promise<number[]>;
}

export class ElevationUnavailableError extends DomainError {
  readonly code = 'ELEVATION_UNAVAILABLE';
  readonly kind = 'unavailable';
}
