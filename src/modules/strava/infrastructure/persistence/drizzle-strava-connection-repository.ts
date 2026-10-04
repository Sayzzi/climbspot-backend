import { eq } from 'drizzle-orm';

import type { Database } from '../../../../shared/infrastructure/database.ts';
import type { StravaConnection } from '../../domain/strava-connection.ts';
import type { StravaConnectionRepository } from '../../domain/strava-connection-repository.ts';
import type { TokenVault } from '../token-vault.ts';
import { stravaConnections } from './strava.schema.ts';

export class DrizzleStravaConnectionRepository implements StravaConnectionRepository {
  constructor(
    private readonly db: Database,
    private readonly vault: TokenVault,
  ) {}

  async find(visitorId: string): Promise<StravaConnection | undefined> {
    const [row] = await this.db
      .select()
      .from(stravaConnections)
      .where(eq(stravaConnections.visitorId, visitorId));
    return (
      row && {
        visitorId: row.visitorId,
        athlete: { id: row.athleteId, name: row.athleteName },
        tokens: {
          accessToken: this.vault.open(row.accessToken),
          refreshToken: this.vault.open(row.refreshToken),
          expiresAt: row.expiresAt,
        },
        connectedAt: row.connectedAt,
        ...(row.lastSyncAt && { lastSyncAt: row.lastSyncAt }),
        ...(row.lostAt && { lostAt: row.lostAt }),
        ...(row.flatPace !== null && { flatPace: row.flatPace }),
      }
    );
  }

  async save(connection: StravaConnection): Promise<void> {
    const values = {
      athleteId: connection.athlete.id,
      athleteName: connection.athlete.name,
      accessToken: this.vault.seal(connection.tokens.accessToken),
      refreshToken: this.vault.seal(connection.tokens.refreshToken),
      expiresAt: connection.tokens.expiresAt,
      connectedAt: connection.connectedAt,
      lastSyncAt: connection.lastSyncAt ?? null,
      lostAt: connection.lostAt ?? null,
      flatPace: connection.flatPace ?? null,
    };
    await this.db
      .insert(stravaConnections)
      .values({ visitorId: connection.visitorId, ...values })
      .onConflictDoUpdate({ target: stravaConnections.visitorId, set: values });
  }

  async flatPaceOf(visitorId: string): Promise<number | undefined> {
    const [row] = await this.db
      .select({ flatPace: stravaConnections.flatPace })
      .from(stravaConnections)
      .where(eq(stravaConnections.visitorId, visitorId));
    return row?.flatPace ?? undefined;
  }

  async delete(visitorId: string): Promise<void> {
    await this.db.delete(stravaConnections).where(eq(stravaConnections.visitorId, visitorId));
  }
}
