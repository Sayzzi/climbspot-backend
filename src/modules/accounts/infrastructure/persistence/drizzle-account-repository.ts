import { eq } from 'drizzle-orm';

import type { Database } from '../../../../shared/infrastructure/database.ts';
import type { Account } from '../../domain/account.ts';
import type { AccountRepository } from '../../domain/account-repository.ts';
import { accounts } from './accounts.schema.ts';

export class DrizzleAccountRepository implements AccountRepository {
  constructor(private readonly db: Database) {}

  async find(visitorId: string): Promise<Account | undefined> {
    const [row] = await this.db.select().from(accounts).where(eq(accounts.visitorId, visitorId));
    return (
      row && {
        visitorId: row.visitorId,
        displayName: row.displayName,
        email: row.email ?? undefined,
        flatPace: row.flatPace ?? undefined,
      }
    );
  }

  async delete(visitorId: string): Promise<void> {
    await this.db.delete(accounts).where(eq(accounts.visitorId, visitorId));
  }

  async save(account: Account): Promise<void> {
    const values = {
      displayName: account.displayName,
      email: account.email ?? null,
      flatPace: account.flatPace ?? null,
    };
    await this.db
      .insert(accounts)
      .values({ visitorId: account.visitorId, ...values })
      .onConflictDoUpdate({ target: accounts.visitorId, set: values });
  }
}
