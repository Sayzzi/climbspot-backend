import { StravaUnavailableError } from '../domain/strava-connection.ts';
import type { StravaGateway } from '../domain/strava-gateway.ts';

const unavailable = () => {
  throw new StravaUnavailableError({ cause: new Error('Strava is not configured') });
};

/** Stands in for Strava while ClimbSpot has no Strava application configured. */
export const unavailableStrava: StravaGateway = {
  authorizationUrl: unavailable,
  exchange: () => Promise.reject(new StravaUnavailableError()),
  refresh: () => Promise.reject(new StravaUnavailableError()),
  revoke: () => Promise.reject(new StravaUnavailableError()),
};
