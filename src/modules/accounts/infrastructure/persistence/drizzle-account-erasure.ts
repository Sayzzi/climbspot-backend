import type { Database } from '../../../../shared/infrastructure/database.ts';
import type { AccountErasure } from '../../domain/account-erasure.ts';
import type { AfterErasure, VisitorDataEraser } from '../../domain/visitor-data-eraser.ts';
import { DrizzleAccountRepository } from './drizzle-account-repository.ts';

/** What one module keeps about a Visitor, erased through the database it is given. */
export type VisitorDataEraserFor = (db: Database) => VisitorDataEraser;

/** Erases an account and what other modules keep about its Visitor in one transaction. */
export class DrizzleAccountErasure implements AccountErasure {
  constructor(
    private readonly db: Database,
    private readonly erasers: readonly VisitorDataEraserFor[],
  ) {}

  async erase(visitorId: string, confirm: () => Promise<void>): Promise<AfterErasure[]> {
    return this.db.transaction(async (transaction) => {
      const afterwards: AfterErasure[] = [];
      for (const eraserFor of this.erasers) {
        const after = await eraserFor(transaction).erase(visitorId);
        if (after) {
          afterwards.push(after);
        }
      }
      await new DrizzleAccountRepository(transaction).delete(visitorId);
      await confirm();
      return afterwards;
    });
  }
}
