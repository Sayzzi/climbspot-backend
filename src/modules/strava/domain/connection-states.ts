/**
 * The `state` that travels through Strava's authorisation: it binds the code Strava
 * returns to the Visitor who asked for it, so that nobody can connect someone else's
 * Strava account to theirs.
 */
export interface ConnectionStates {
  issue(visitorId: string): string;
  belongsTo(state: string, visitorId: string): boolean;
}
