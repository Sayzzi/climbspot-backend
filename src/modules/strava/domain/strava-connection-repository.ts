import type { StravaConnection } from './strava-connection.ts';

export interface StravaConnectionRepository {
  find(visitorId: string): Promise<StravaConnection | undefined>;
  /** Saves the connection, creating it or replacing what was kept. */
  save(connection: StravaConnection): Promise<void>;
  delete(visitorId: string): Promise<void>;
}
