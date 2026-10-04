/** The Flat Pace worked out from a Visitor's Recorded Runs, through their Strava Connection. */
export interface StravaFlatPace {
  /** Seconds per kilometre; none without a connection or enough flat kilometres. */
  of(visitorId: string): Promise<number | undefined>;
}

/** No Strava Connection is ever there. */
export const noStravaFlatPace: StravaFlatPace = { of: () => Promise.resolve(undefined) };
