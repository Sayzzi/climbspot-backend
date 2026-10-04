import type { Identity } from '../../../shared/domain/identity.ts';
import {
  flatPaceOf,
  newAccount,
  type Account,
  type AccountWithFlatPace,
} from '../domain/account.ts';
import type { AccountRepository } from '../domain/account-repository.ts';
import type { StravaFlatPace } from '../domain/strava-flat-pace.ts';

/**
 * The signed-in Visitor's account, created the first time they ask for it, with the
 * Flat Pace that applies. Its e-mail follows the identity's, which the Visitor may
 * change with Supabase.
 */
export class GetMyAccount {
  constructor(
    private readonly accounts: AccountRepository,
    private readonly stravaFlatPace: StravaFlatPace,
  ) {}

  async execute(identity: Identity): Promise<AccountWithFlatPace> {
    return this.withFlatPace(await this.account(identity));
  }

  /** The account as kept, created or brought up to date first. */
  async account(identity: Identity): Promise<Account> {
    const existing = await this.accounts.find(identity.visitorId);
    if (existing && existing.email === identity.email) {
      return existing;
    }
    if (existing) {
      const current = { ...existing, email: identity.email };
      await this.accounts.save(current);
      return current;
    }
    const account = newAccount(identity);
    await this.accounts.save(account);
    return account;
  }

  async withFlatPace(account: Account): Promise<AccountWithFlatPace> {
    const stravaFlatPace = await this.stravaFlatPace.of(account.visitorId);
    return { account, flatPace: flatPaceOf(account, stravaFlatPace), stravaFlatPace };
  }
}
