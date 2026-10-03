import type { Identity } from '../../../shared/domain/identity.ts';
import type { Account } from '../domain/account.ts';
import type { AccountRepository } from '../domain/account-repository.ts';
import type { GetMyAccount } from './get-my-account.ts';

export interface AccountChanges {
  readonly displayName?: string;
  /** Seconds per kilometre, or `null` to clear it. */
  readonly flatPace?: number | null;
}

/** Changes the signed-in Visitor's display name or Flat Pace. */
export class UpdateMyAccount {
  constructor(
    private readonly accounts: AccountRepository,
    private readonly getMyAccount: GetMyAccount,
  ) {}

  async execute(identity: Identity, changes: AccountChanges): Promise<Account> {
    const account = await this.getMyAccount.execute(identity);
    const updated: Account = {
      ...account,
      ...(changes.displayName !== undefined && { displayName: changes.displayName }),
      ...(changes.flatPace !== undefined && { flatPace: changes.flatPace ?? undefined }),
    };
    await this.accounts.save(updated);
    return updated;
  }
}
