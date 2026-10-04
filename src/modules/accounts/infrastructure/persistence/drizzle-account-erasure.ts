import type { Database } from '../../../../shared/infrastructure/database.ts';
import type { AccountErasure } from '../../domain/account-erasure.ts';
import type { VisitorDataEraser } from '../../domain/visitor-data-eraser.ts';
import { DrizzleAccountRepository } from './drizzle-account-repository.ts';

/** What one module keeps about a Visitor, erased through the database it is given. */
export type VisitorDataEraserFor = (db: Database) => VisitorDataEraser;

/** Erases an account and what other modules keep about its Visitor in one transaction. */
export class DrizzleAccountErasure implements AccountErasure {
  constructor(
    private readonly db: Database,
    private readonly erasers: readonly VisitorDataEraserFor[],
  ) {}

  async erase(visitorId: string, confirm: () => Promise<void>): Promise<void> {
    await this.db.transaction(async (transaction) => {
      for (const eraserFor of this.erasers) {
        await eraserFor(transaction).erase(visitorId);
      }
      await new DrizzleAccountRepository(transaction).delete(visitorId);
      await confirm();
    });
  }
}
