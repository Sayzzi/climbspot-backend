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

/** Round trips explored around the point first when looking for an Uphill Itinerary. */
export const UPHILL_ROUND_TRIPS = 2;

/** Length of those round trips, as a multiple of the asked length. */
export const UPHILL_ROUND_TRIP_FACTOR = 2.5;

/**
 * Then ways from the point towards these bearings (degrees), alternating so that a
 * spent budget still leaves the explored directions spread around the point. Round
 * trips stay near the point; these reach the hills elsewhere within the radius.
 */
export const UPHILL_SPOKE_BEARINGS = [0, 180, 90, 270, 45, 225, 135, 315] as const;

/** How far those ways head, as a share of the radius. */
export const UPHILL_SPOKE_REACH = 0.8;

/**
 * Bearings at which Loops are tried, in degrees: each sends the Loop another way. The
 * route ignores the Relief, so more directions give it more Loops to choose from;
 * they alternate so that a spent budget still leaves them spread around the point.
 */
export const LOOP_BEARINGS = [0, 180, 60, 240, 120, 300] as const;

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

/** How long a planning answer is reused for an identical request, in milliseconds. */
export const PLANNING_CACHE_TTL = 24 * 60 * 60 * 1000;

/** Planning answers kept at most; the oldest are forgotten first. */
export const PLANNING_CACHE_SIZE = 500;

/** Requests whose points round to the same 1e-4 degree (~10 m) are the same request. */
export const PLANNING_POINT_DECIMALS = 4;
