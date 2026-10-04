import type { StravaAthlete, StravaTokens } from './strava-connection.ts';

/** What Strava gives when a Visitor lets ClimbSpot read their account. */
export interface StravaGrant {
  readonly athlete: StravaAthlete;
  readonly tokens: StravaTokens;
}

/**
 * Strava's API, as ClimbSpot uses it. Every call may fail with a
 * `StravaUnavailableError` when Strava is down or its limits are reached.
 */
export interface StravaGateway {
  /** Where a Visitor agrees to the connection; Strava sends them back with `state`. */
  authorizationUrl(state: string): string;
  /** @throws {StravaAuthorizationRefusedError} when Strava does not accept the code. */
  exchange(code: string): Promise<StravaGrant>;
  /** @throws {StravaConnectionLostError} when the Visitor withdrew ClimbSpot's access. */
  refresh(refreshToken: string): Promise<StravaTokens>;
  /** Withdraws ClimbSpot's access to the athlete's account. */
  revoke(accessToken: string): Promise<void>;
}
