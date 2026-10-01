/*
 * Provisional numbers used to survey an Ascent. They are to be calibrated on real
 * Ascents together with ADR 0006; keep every tunable value here.
 */

/**
 * Distance between two points of a resampled path, in metres. Close to the ~90 m
 * resolution of the terrain model: denser sampling only adds noise (counted as
 * Dips) and spends the elevation API's per-point quota (ADR 0005).
 */
export const SAMPLING_SPACING = 100;

/** Number of samples averaged when smoothing an Elevation Profile (odd): ~200 m. */
export const SMOOTHING_WINDOW = 3;

/** Shortest stretch over which the maximum Gradient is measured, in metres. */
export const MAXIMUM_GRADIENT_STRETCH = 100;

/** Longest path accepted as an Ascent, in metres. */
export const MAXIMUM_LENGTH = 50_000;

/** Largest GPX file accepted, in bytes. */
export const MAXIMUM_GPX_FILE_SIZE = 5 * 1024 * 1024;

/** Most points a path may have before resampling. */
export const MAXIMUM_PATH_POINTS = 20_000;

/** Flattest average Gradient of an Ascent (ratio). */
export const MINIMUM_AVERAGE_GRADIENT = 0.03;

/** Smallest Elevation Gain of an Ascent, in metres. */
export const MINIMUM_ELEVATION_GAIN = 10;

/**
 * Height an Ascent may lose in Dips: the larger of a fixed allowance (metres)
 * and a share of its Elevation Gain.
 */
export const DIP_ALLOWANCE = 10;
export const DIP_ALLOWANCE_RATIO = 0.1;
