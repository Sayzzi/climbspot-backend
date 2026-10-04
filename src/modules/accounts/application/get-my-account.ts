import type { Identity } from '../../../shared/domain/identity.ts';
import { newAccount, type Account } from '../domain/account.ts';
import type { AccountRepository } from '../domain/account-repository.ts';

/**
 * The signed-in Visitor's account, created the first time they ask for it. Its e-mail
 * follows the identity's, which the Visitor may change with Supabase.
 */
export class GetMyAccount {
  constructor(private readonly accounts: AccountRepository) {}

  async execute(identity: Identity): Promise<Account> {
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
}
