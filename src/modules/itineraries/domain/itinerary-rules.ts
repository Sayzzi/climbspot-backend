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

/** Two proposals whose ends are both closer than this, in metres, are the same. */
export const SAME_ITINERARY_DISTANCE = 200;
