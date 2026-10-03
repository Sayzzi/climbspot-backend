import type { Account } from './account.ts';

export interface AccountRepository {
  find(visitorId: string): Promise<Account | undefined>;
  /** Saves the account, creating it or replacing what was kept. */
  save(account: Account): Promise<void>;
}
