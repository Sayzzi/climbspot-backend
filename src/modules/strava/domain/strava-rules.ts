/**
 * Provisional rules for what ClimbSpot takes from Strava, kept together so that they
 * can be tuned against real Recorded Runs.
 */

/** Months of Recorded Runs imported when a Visitor connects. */
export const IMPORT_MONTHS = 3;

/** Strava sport types imported as Recorded Runs: running and trail running only. */
export const RECORDED_RUN_SPORTS: readonly string[] = ['Run', 'TrailRun'];

/** Metres between the points kept of a Recorded Run's track. */
export const TRACK_SPACING = 10;

/** Metres of the stretches a Flat Pace is measured over. */
export const FLAT_STRETCH_LENGTH = 100;

/** Steepest Gradient, up or down, of a stretch counted as flat. */
export const FLAT_GRADIENT_LIMIT = 0.01;

/** Fewest metres of flat stretches a Flat Pace is worked out from; below, there is none. */
export const MINIMUM_FLAT_DISTANCE = 10_000;
