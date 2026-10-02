/*
 * Provisional numbers for planning Itineraries (ADR 0008). To calibrate on real
 * requests; keep every tunable value here.
 */

/** An Itinerary may be at most this share longer than asked for, never shorter. */
export const LENGTH_TOLERANCE = 0.2;

/** Proposals answered for one request. */
export const MAXIMUM_PROPOSALS = 3;

/** Routing calls one planning request may make. */
export const ROUTING_CALL_BUDGET = 10;

/** Round trips explored around the point when looking for an Uphill Itinerary. */
export const UPHILL_ROUND_TRIPS = 6;

/** Length of those round trips, as a multiple of the asked length. */
export const UPHILL_ROUND_TRIP_FACTOR = 2.5;

/** Bearings at which Loops are tried, in degrees: each sends the Loop another way. */
export const LOOP_BEARINGS = [0, 120, 240] as const;

/** Attempts per bearing to bring a Loop to the asked length by rescaling it. */
export const LOOP_ATTEMPTS_PER_BEARING = 3;

/** Ways wind: a Loop is about this much longer than the polygon through its waypoints. */
export const LOOP_WINDING_FACTOR = 1.25;

/** Rescaled Loops aim this much above the asked distance, inside the tolerance. */
export const LOOP_LENGTH_TARGET = 1.1;

/** Height Gained per kilometre separating flat from rolling, and rolling from hilly. */
export const ROLLING_FROM = 10;
export const HILLY_ABOVE = 25;

/** Two proposals whose ends are both closer than this, in metres, are the same. */
export const SAME_ITINERARY_DISTANCE = 200;
