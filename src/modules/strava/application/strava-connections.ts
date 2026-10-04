import type { ConnectionStates } from '../domain/connection-states.ts';
import {
  StravaAuthorizationRefusedError,
  type StravaConnection,
  type StravaTokens,
} from '../domain/strava-connection.ts';
import type { StravaConnectionRepository } from '../domain/strava-connection-repository.ts';
import type { StravaGateway } from '../domain/strava-gateway.ts';

/** Tokens this close to expiring are refreshed before use. */
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

export interface StravaConnectionsDependencies {
  readonly connections: StravaConnectionRepository;
  readonly gateway: StravaGateway;
  readonly states: ConnectionStates;
  readonly now: () => Date;
}

/** Making, reading and ending a signed-in Visitor's Strava Connection. */
export class StravaConnections {
  constructor(private readonly dependencies: StravaConnectionsDependencies) {}

  authorizationUrl(visitorId: string): string {
    const { gateway, states } = this.dependencies;
    return gateway.authorizationUrl(states.issue(visitorId));
  }

  /**
   * @throws {StravaAuthorizationRefusedError} when the state is not the Visitor's, or
   * Strava refuses the code.
   */
  async connect(
    visitorId: string,
    { code, state }: { code: string; state: string },
  ): Promise<StravaConnection> {
    const { connections, gateway, states, now } = this.dependencies;
    if (!states.belongsTo(state, visitorId)) {
      throw new StravaAuthorizationRefusedError();
    }
    const grant = await gateway.exchange(code);
    const connection = { visitorId, ...grant, connectedAt: now() };
    await connections.save(connection);
    return connection;
  }

  find(visitorId: string): Promise<StravaConnection | undefined> {
    return this.dependencies.connections.find(visitorId);
  }

  /**
   * Erases the connection, after withdrawing ClimbSpot's access at Strava when Strava
   * can be reached: the Visitor's wish to disconnect never waits on Strava.
   */
  async end(visitorId: string): Promise<void> {
    const { connections, gateway } = this.dependencies;
    const connection = await connections.find(visitorId);
    if (!connection) {
      return;
    }
    try {
      await gateway.revoke((await this.freshTokens(connection)).accessToken);
    } catch {
      // Strava will keep a grant ClimbSpot no longer holds: the Visitor can withdraw it there.
    }
    await connections.delete(visitorId);
  }

  /** The connection's tokens, refreshed and saved first when about to expire. */
  private async freshTokens(connection: StravaConnection): Promise<StravaTokens> {
    const { connections, gateway, now } = this.dependencies;
    if (connection.tokens.expiresAt.getTime() - now().getTime() > REFRESH_MARGIN_MS) {
      return connection.tokens;
    }
    const tokens = await gateway.refresh(connection.tokens.refreshToken);
    await connections.save({ ...connection, tokens });
    return tokens;
  }
}
