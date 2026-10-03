import { AccountDeletionUnavailableError } from '../domain/account.ts';
import type { AccountDirectory } from '../domain/account-directory.ts';
import type { AccountRepository } from '../domain/account-repository.ts';
import type { VisitorDataEraser } from '../domain/visitor-data-eraser.ts';

export interface DeleteMyAccountDependencies {
  readonly accounts: AccountRepository;
  readonly directory: AccountDirectory;
  /** What other parts of ClimbSpot keep about the Visitor. */
  readonly erasers: readonly VisitorDataEraser[];
}

/**
 * Deletes a signed-in Visitor's account: first their identity, so that a failure there
 * leaves everything as it was, then everything ClimbSpot keeps about them.
 */
export class DeleteMyAccount {
  constructor(private readonly dependencies: DeleteMyAccountDependencies) {}

  /** @throws {AccountDeletionUnavailableError} when the identity cannot be deleted. */
  async execute(visitorId: string): Promise<void> {
    const { accounts, directory, erasers } = this.dependencies;
    try {
      await directory.deleteVisitor(visitorId);
    } catch (error) {
      throw new AccountDeletionUnavailableError({ cause: error });
    }
    for (const eraser of erasers) {
      await eraser.erase(visitorId);
    }
    await accounts.delete(visitorId);
  }
}
