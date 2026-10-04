import type { ConnectionStates } from '../domain/connection-states.ts';
import { flatPaceFrom } from '../domain/flat-pace.ts';
import { firstImportStart, isRecordedRunSport, toTrack } from '../domain/recorded-run.ts';
import type { RecordedRunRepository } from '../domain/recorded-run-repository.ts';
import {
  StravaAuthorizationRefusedError,
  StravaConnectionLostError,
  StravaUnavailableError,
  type StravaConnection,
  type StravaTokens,
} from '../domain/strava-connection.ts';
import type { StravaConnectionRepository } from '../domain/strava-connection-repository.ts';
import type { StravaGateway } from '../domain/strava-gateway.ts';

/** Tokens this close to expiring are refreshed before use. */
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

export interface StravaConnectionsDependencies {
  readonly connections: StravaConnectionRepository;
  readonly runs: RecordedRunRepository;
  readonly gateway: StravaGateway;
  readonly states: ConnectionStates;
  readonly now: () => Date;
}

/** A Visitor's Strava Connection, if any, and how many Recorded Runs came through it. */
export interface StravaConnectionState {
  readonly connection: StravaConnection | undefined;
  readonly recordedRuns: number;
}

/** Making, synchronising and ending a signed-in Visitor's Strava Connection. */
export class StravaConnections {
  constructor(private readonly dependencies: StravaConnectionsDependencies) {}

  authorizationUrl(visitorId: string): string {
    const { gateway, states } = this.dependencies;
    return gateway.authorizationUrl(states.issue(visitorId));
  }

  /**
   * Makes the connection, then imports the Recorded Runs of the last months: when
   * Strava stops answering midway, the connection stands and the import carries on at
   * the next synchronisation.
   * @throws {StravaAuthorizationRefusedError} when the state is not the Visitor's, or
   * Strava refuses the code.
   */
  async connect(
    visitorId: string,
    { code, state }: { code: string; state: string },
  ): Promise<StravaConnectionState> {
    const { connections, runs, gateway, states, now } = this.dependencies;
    if (!states.belongsTo(state, visitorId)) {
      throw new StravaAuthorizationRefusedError();
    }
    const grant = await gateway.exchange(code);
    // Another athlete's Recorded Runs are not this one's.
    const previous = await connections.find(visitorId);
    if (previous && previous.athlete.id !== grant.athlete.id) {
      await runs.deleteAllOf(visitorId);
    }
    const connection: StravaConnection = { visitorId, ...grant, connectedAt: now() };
    await connections.save(connection);
    try {
      await this.importRuns(connection);
    } catch (error) {
      if (!(error instanceof StravaUnavailableError)) {
        throw error;
      }
    }
    return this.find(visitorId);
  }

  async find(visitorId: string): Promise<StravaConnectionState> {
    const { connections, runs } = this.dependencies;
    const [connection, recordedRuns] = await Promise.all([
      connections.find(visitorId),
      runs.count(visitorId),
    ]);
    return { connection, recordedRuns };
  }

  /**
   * Imports the Recorded Runs started since the latest one.
   * @throws {StravaConnectionLostError} when the Visitor withdrew ClimbSpot at Strava.
   * @throws {StravaUnavailableError} when Strava stops answering; what was imported stays.
   */
  async sync(visitorId: string): Promise<StravaConnectionState> {
    const connection = await this.dependencies.connections.find(visitorId);
    if (connection?.lostAt) {
      throw new StravaConnectionLostError();
    }
    if (connection) {
      await this.importRuns(connection);
    }
    return this.find(visitorId);
  }

  /**
   * Erases the connection and its Recorded Runs, after withdrawing ClimbSpot's access
   * at Strava when Strava can be reached: the Visitor's wish to disconnect never waits
   * on Strava.
   */
  async end(visitorId: string): Promise<void> {
    const { connections, runs, gateway } = this.dependencies;
    const connection = await connections.find(visitorId);
    if (!connection) {
      return;
    }
    try {
      await gateway.revoke((await this.freshTokens(connection)).accessToken);
    } catch {
      // Strava will keep a grant ClimbSpot no longer holds: the Visitor can withdraw it there.
    }
    await runs.deleteAllOf(visitorId);
    await connections.delete(visitorId);
  }

  /** The Flat Pace worked out from the Visitor's Recorded Runs, if any. */
  async flatPace(visitorId: string): Promise<number | undefined> {
    return (await this.dependencies.connections.find(visitorId))?.flatPace;
  }

  /**
   * Imports, oldest first, the running outings started since the latest Recorded Run,
   * then works out the Flat Pace again from the last months' ones.
   */
  private async importRuns(connection: StravaConnection): Promise<void> {
    const { connections, runs, gateway, now } = this.dependencies;
    await this.watchingForLoss(connection, async () => {
      const { accessToken } = await this.freshTokens(connection);
      const since = (await runs.latestStart(connection.visitorId)) ?? firstImportStart(now());
      const outings = await gateway.outingsSince(accessToken, since);
      for (const outing of outings.filter((listed) => isRecordedRunSport(listed.sport))) {
        await runs.save({
          visitorId: connection.visitorId,
          stravaId: outing.id,
          startedAt: outing.startedAt,
          distance: outing.distance,
          movingTime: outing.movingTime,
          track: toTrack(await gateway.track(accessToken, outing.id)),
        });
      }
    });
    const current = await connections.find(connection.visitorId);
    if (current) {
      const { flatPace: _previous, ...rest } = current;
      const tracks = await runs.tracksSince(current.visitorId, firstImportStart(now()));
      const flatPace = flatPaceFrom(tracks);
      await connections.save({
        ...rest,
        lastSyncAt: now(),
        ...(flatPace !== undefined && { flatPace }),
      });
    }
  }

  /** Runs `work`, marking the connection lost when Strava no longer accepts it. */
  private async watchingForLoss(connection: StravaConnection, work: () => Promise<void>) {
    try {
      await work();
    } catch (error) {
      if (error instanceof StravaConnectionLostError) {
        const current =
          (await this.dependencies.connections.find(connection.visitorId)) ?? connection;
        await this.dependencies.connections.save({ ...current, lostAt: this.dependencies.now() });
      }
      throw error;
    }
  }

  /** The connection's tokens, refreshed and saved first when about to expire. */
  private async freshTokens(connection: StravaConnection): Promise<StravaTokens> {
    const { connections, gateway, now } = this.dependencies;
    const current = (await connections.find(connection.visitorId)) ?? connection;
    if (current.tokens.expiresAt.getTime() - now().getTime() > REFRESH_MARGIN_MS) {
      return current.tokens;
    }
    const tokens = await gateway.refresh(current.tokens.refreshToken);
    await connections.save({ ...current, tokens });
    return tokens;
  }
}
