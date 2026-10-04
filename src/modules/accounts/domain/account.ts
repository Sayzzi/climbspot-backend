import { DomainError } from '../../../shared/domain/domain-error.ts';
import type { Identity } from '../../../shared/domain/identity.ts';

/** What ClimbSpot keeps about a signed-in Visitor, private to them. */
export interface Account {
  readonly visitorId: string;
  readonly displayName: string;
  readonly email: string | undefined;
  /** The Flat Pace the Visitor stated, in seconds per kilometre. */
  readonly flatPace: number | undefined;
}

/** Where a Flat Pace comes from: the Visitor, or their Recorded Runs on Strava. */
export type FlatPaceSource = 'stated' | 'strava';

export interface FlatPace {
  readonly secondsPerKm: number;
  readonly source: FlatPaceSource;
}

/** An account, with the Flat Pace that applies to it. */
export interface MyAccount {
  readonly account: Account;
  readonly flatPace: FlatPace | undefined;
  /** The Flat Pace from Strava, even when a stated one applies: the Visitor may go back to it. */
  readonly stravaFlatPace: number | undefined;
}

/** The Flat Pace that applies: the one the Visitor stated, or else Strava's. */
export function flatPaceOf(account: Account, fromStrava: number | undefined): FlatPace | undefined {
  if (account.flatPace !== undefined) {
    return { secondsPerKm: account.flatPace, source: 'stated' };
  }
  return fromStrava === undefined ? undefined : { secondsPerKm: fromStrava, source: 'strava' };
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

export class AccountDeletionUnavailableError extends DomainError {
  readonly code = 'ACCOUNT_DELETION_UNAVAILABLE';
  readonly kind = 'unavailable';

  constructor(options?: ErrorOptions) {
    super('The account cannot be deleted right now; nothing was erased.', options);
  }
}
