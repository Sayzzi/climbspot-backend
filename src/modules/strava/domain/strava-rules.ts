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
