/*
 * Provisional numbers used to survey an Ascent. They are to be calibrated on real
 * Ascents together with ADR 0006; keep every tunable value here.
 */

/** Distance between two points of a resampled path, in metres. */
export const SAMPLING_SPACING = 25;

/** Number of samples averaged when smoothing an Elevation Profile (odd). */
export const SMOOTHING_WINDOW = 5;

/** Shortest stretch over which the maximum Gradient is measured, in metres. */
export const MAXIMUM_GRADIENT_STRETCH = 100;
