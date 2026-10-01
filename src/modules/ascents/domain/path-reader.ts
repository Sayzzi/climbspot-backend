import type { Position } from './position.ts';

/**
 * Reads the 2D path of an uploaded file, dropping any elevation it carries (ADR 0005).
 *
 * @throws {GpxInvalidError | GpxEmptyError | GpxTooLargeError} when no usable path can be read.
 */
export type PathReader = (content: string) => Position[];
