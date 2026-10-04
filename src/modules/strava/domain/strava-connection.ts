import { DomainError } from '../../../shared/domain/domain-error.ts';

/** The Strava athlete a Visitor connected. */
export interface StravaAthlete {
  readonly id: number;
  readonly name: string;
}

/** What lets ClimbSpot read a Visitor's Strava account on their behalf. */
export interface StravaTokens {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresAt: Date;
}

/** The link a signed-in Visitor made with their Strava account (see CONTEXT.md). */
export interface StravaConnection {
  readonly visitorId: string;
  readonly athlete: StravaAthlete;
  readonly tokens: StravaTokens;
  readonly connectedAt: Date;
  /** When Recorded Runs were last imported in full. */
  readonly lastSyncAt?: Date;
  /** When Strava stopped accepting the connection: the Visitor withdrew ClimbSpot there. */
  readonly lostAt?: Date;
}

/** Strava is down, or its limits are reached: trying again later may work. */
export class StravaUnavailableError extends DomainError {
  readonly code = 'STRAVA_UNAVAILABLE';
  readonly kind = 'unavailable';

  constructor(options?: ErrorOptions) {
    super('Strava is unavailable or its limits are reached; try again later.', options);
  }
}

/** Strava refused the code, or the code was asked for by someone else. */
export class StravaAuthorizationRefusedError extends DomainError {
  readonly code = 'STRAVA_AUTHORIZATION_REFUSED';
  readonly kind = 'invalid';

  constructor(options?: ErrorOptions) {
    super('This Strava authorisation cannot be used; connect again.', options);
  }
}

/** The Visitor withdrew ClimbSpot's access from Strava's side: they need to connect again. */
export class StravaConnectionLostError extends DomainError {
  readonly code = 'STRAVA_CONNECTION_LOST';
  readonly kind = 'conflict';

  constructor(options?: ErrorOptions) {
    super('Strava no longer accepts this connection; connect again.', options);
  }
}
