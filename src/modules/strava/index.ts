import type { HttpModule } from '../../shared/http/http-module.ts';
import type { Database } from '../../shared/infrastructure/database.ts';
import { StravaConnections } from './application/strava-connections.ts';
import type { StravaGateway } from './domain/strava-gateway.ts';
import { registerStravaOpenApi } from './http/strava.openapi.ts';
import { createStravaRouter } from './http/strava.router.ts';
import { DrizzleStravaConnectionRepository } from './infrastructure/persistence/drizzle-strava-connection-repository.ts';
import { SignedConnectionStates } from './infrastructure/signed-connection-states.ts';
import { TokenVault } from './infrastructure/token-vault.ts';

export type { StravaGateway, StravaGrant } from './domain/strava-gateway.ts';
export {
  StravaAuthorizationRefusedError,
  StravaConnectionLostError,
  StravaUnavailableError,
} from './domain/strava-connection.ts';
export { StravaApiGateway } from './infrastructure/strava-api-gateway.ts';
export { unavailableStrava } from './infrastructure/unavailable-strava.ts';

export interface StravaSettings {
  readonly gateway: StravaGateway;
  /** 32 bytes, base64: encrypts the stored tokens and signs the connection states. */
  readonly tokenKey: string;
}

const basePath = '/strava';

function stravaConnections(db: Database, { gateway, tokenKey }: StravaSettings) {
  return new StravaConnections({
    connections: new DrizzleStravaConnectionRepository(db, new TokenVault(tokenKey)),
    gateway,
    states: new SignedConnectionStates(tokenKey),
    now: () => new Date(),
  });
}

/** The Strava Connection: linking a Visitor's Strava account, and ending the link. */
export function createStravaModule({
  db,
  ...settings
}: StravaSettings & { readonly db: Database }): HttpModule {
  return {
    basePath,
    router: createStravaRouter(stravaConnections(db, settings)),
    registerOpenApi: (registry) => {
      registerStravaOpenApi(registry, basePath);
    },
  };
}

/** Ends a Visitor's Strava Connection when their account is deleted. */
export function forgetStravaConnection(settings: StravaSettings) {
  return (db: Database) => {
    const connections = stravaConnections(db, settings);
    return { erase: (visitorId: string) => connections.end(visitorId) };
  };
}
