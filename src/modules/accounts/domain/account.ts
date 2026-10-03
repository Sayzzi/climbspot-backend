import type { Identity } from '../../../shared/domain/identity.ts';

/** What ClimbSpot keeps about a signed-in Visitor, private to them. */
export interface Account {
  readonly visitorId: string;
  readonly displayName: string;
  readonly email: string | undefined;
  /** Seconds per kilometre, once stated. */
  readonly flatPace: number | undefined;
}

/** Display names are at most this long. */
export const DISPLAY_NAME_MAX_LENGTH = 60;

/** Flat Paces accepted, in seconds per kilometre (3:00 to 12:00 per km). */
export const FASTEST_FLAT_PACE = 180;
export const SLOWEST_FLAT_PACE = 720;

/** A new account, named after its identity: its name, or else its e-mail before the @. */
export function newAccount(identity: Identity): Account {
  const fromEmail = identity.email?.split('@')[0];
  const displayName = (identity.name ?? fromEmail ?? 'Visitor').slice(0, DISPLAY_NAME_MAX_LENGTH);
  return {
    visitorId: identity.visitorId,
    displayName,
    email: identity.email,
    flatPace: undefined,
  };
}
