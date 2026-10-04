import type { StravaConnection } from './strava-connection.ts';

export interface StravaConnectionRepository {
  find(visitorId: string): Promise<StravaConnection | undefined>;
  /** Saves the connection, creating it or replacing what was kept. */
  save(connection: StravaConnection): Promise<void>;
  delete(visitorId: string): Promise<void>;
  /** The Flat Pace worked out for the Visitor, without reading their tokens. */
  flatPaceOf(visitorId: string): Promise<number | undefined>;
}
