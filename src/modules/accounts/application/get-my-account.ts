import type { Identity } from '../../../shared/domain/identity.ts';
import { newAccount, type Account } from '../domain/account.ts';
import type { AccountRepository } from '../domain/account-repository.ts';

/** The signed-in Visitor's account, created the first time they ask for it. */
export class GetMyAccount {
  constructor(private readonly accounts: AccountRepository) {}

  async execute(identity: Identity): Promise<Account> {
    const existing = await this.accounts.find(identity.visitorId);
    if (existing) {
      return existing;
    }
    const account = newAccount(identity);
    await this.accounts.save(account);
    return account;
  }
}
