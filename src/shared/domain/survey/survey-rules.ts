/*
 * Provisional numbers used to survey any path (Ascents and Itineraries alike). They
 * are to be calibrated on real paths together with ADR 0005 and ADR 0006.
 */

/**
 * Distance between two points of a resampled path, in metres. Close to the ~90 m
 * resolution of the terrain model: denser sampling only adds noise (counted as
 * Dips) and spends the elevation API's per-point quota (ADR 0005).
 */
export const SAMPLING_SPACING = 100;

/**
 * How far, in metres, the path shown on maps may stray from the uploaded one once
 * simplified: points closer than this to the line are dropped.
 */
export const PATH_SIMPLIFICATION_TOLERANCE = 5;

/** Number of samples averaged when smoothing an Elevation Profile (odd): ~200 m. */
export const SMOOTHING_WINDOW = 3;

/**
 * Shortest stretch over which the maximum Gradient is measured, in metres. The terrain
 * model reads the slopes beside hairpins, so shorter stretches report walls that are
 * not there: on Mont Ventoux, 19 % over 100 m and 16 % over 300 m, against 13 % over
 * 500 m (ADR 0005).
 */
export const MAXIMUM_GRADIENT_STRETCH = 500;

/**
 * Height a path going up may lose in Dips: the larger of a fixed allowance (metres)
 * and a share of its Elevation Gain.
 */
export const DIP_ALLOWANCE = 10;
export const DIP_ALLOWANCE_RATIO = 0.1;
