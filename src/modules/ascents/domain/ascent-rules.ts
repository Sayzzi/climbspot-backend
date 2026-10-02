/*
 * Provisional rules for what qualifies as an Ascent (ADR 0006). How paths are
 * surveyed and measured lives in the shared survey rules.
 */

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
