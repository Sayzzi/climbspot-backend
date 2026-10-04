import type { HttpModule } from '../../shared/http/http-module.ts';
import type { Database } from '../../shared/infrastructure/database.ts';
import { AscentTimes } from './application/ascent-times.ts';
import { StravaConnections } from './application/strava-connections.ts';
import type { AscentPath } from '../../shared/domain/ascent-times.ts';
import { emptyCatalogue, type AscentCatalogue } from './domain/ascent-catalogue.ts';
import type { StravaGateway } from './domain/strava-gateway.ts';
import { registerStravaOpenApi } from './http/strava.openapi.ts';
import { createStravaRouter } from './http/strava.router.ts';
import { DrizzleAscentTimeRepository } from './infrastructure/persistence/drizzle-ascent-time-repository.ts';
import { DrizzleRecordedRunRepository } from './infrastructure/persistence/drizzle-recorded-run-repository.ts';
import { DrizzleStravaConnectionRepository } from './infrastructure/persistence/drizzle-strava-connection-repository.ts';
import { SignedConnectionStates } from './infrastructure/signed-connection-states.ts';
import { TokenVault } from './infrastructure/token-vault.ts';

export type { AscentCatalogue } from './domain/ascent-catalogue.ts';
export type { TrackSample } from './domain/recorded-run.ts';
export type { StravaGateway, StravaGrant, StravaOuting } from './domain/strava-gateway.ts';
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

function ascentTimes(db: Database, catalogue: AscentCatalogue = emptyCatalogue) {
  return new AscentTimes({
    times: new DrizzleAscentTimeRepository(db),
    runs: new DrizzleRecordedRunRepository(db),
    catalogue,
  });
}

function stravaConnections(
  db: Database,
  { gateway, tokenKey }: StravaSettings,
  catalogue?: AscentCatalogue,
) {
  return new StravaConnections({
    connections: new DrizzleStravaConnectionRepository(db, new TokenVault(tokenKey)),
    runs: new DrizzleRecordedRunRepository(db),
    ascentTimes: ascentTimes(db, catalogue),
    gateway,
    states: new SignedConnectionStates(tokenKey),
    now: () => new Date(),
  });
}

/** The Strava Connection: linking a Visitor's Strava account, importing their Recorded Runs, and ending the link. */
export function createStravaModule({
  db,
  catalogue,
  ...settings
}: StravaSettings & {
  readonly db: Database;
  /** The Ascents Recorded Runs may go up. */
  readonly catalogue: AscentCatalogue;
}): HttpModule {
  return {
    basePath,
    router: createStravaRouter(stravaConnections(db, settings, catalogue)),
    registerOpenApi: (registry) => {
      registerStravaOpenApi(registry, basePath);
    },
  };
}

/** The Flat Pace worked out from each Visitor's Recorded Runs, for their account. */
export function stravaFlatPace({
  db,
  tokenKey,
}: Pick<StravaSettings, 'tokenKey'> & { readonly db: Database }) {
  const connections = new DrizzleStravaConnectionRepository(db, new TokenVault(tokenKey));
  return { of: (visitorId: string) => connections.flatPaceOf(visitorId) };
}

/** Ends a Visitor's Strava Connection when their account is deleted. */
export function forgetStravaConnection(settings: StravaSettings) {
  return (db: Database) => {
    const connections = stravaConnections(db, settings);
    return { erase: (visitorId: string) => connections.erase(visitorId) };
  };
}

/** Each Visitor's own Ascent Times, for the Ascents they look at. */
export function stravaAscentTimes(db: Database) {
  const times = new DrizzleAscentTimeRepository(db);
  return {
    summaries: (visitorId: string, ascentIds: readonly string[]) =>
      times.summaries(visitorId, ascentIds),
    of: async (visitorId: string, ascentId: string) =>
      (await times.of(visitorId, ascentId)).map(({ startedAt, seconds }) => ({
        startedAt,
        seconds,
      })),
  };
}

/** Finds, in every stored Recorded Run, the Ascent Times of an Ascent just added. */
export function matchNewAscent(db: Database) {
  const times = ascentTimes(db);
  return (ascent: AscentPath) => times.onAscent(ascent);
}
