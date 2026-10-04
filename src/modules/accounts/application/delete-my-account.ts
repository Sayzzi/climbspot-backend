import { AccountDeletionUnavailableError } from '../domain/account.ts';
import type { AccountDirectory } from '../domain/account-directory.ts';
import type { AccountErasure } from '../domain/account-erasure.ts';

export interface DeleteMyAccountDependencies {
  readonly erasure: AccountErasure;
  readonly directory: AccountDirectory;
}

/**
 * Deletes a signed-in Visitor's account: everything ClimbSpot keeps about them, then
 * their identity last, so that a failure anywhere leaves everything as it was. Only
 * then are other services told, e.g. Strava withdrawing ClimbSpot's access.
 */
export class DeleteMyAccount {
  constructor(private readonly dependencies: DeleteMyAccountDependencies) {}

  /** @throws {AccountDeletionUnavailableError} when the identity cannot be deleted. */
  async execute(visitorId: string): Promise<void> {
    const { erasure, directory } = this.dependencies;
    const afterwards = await erasure.erase(visitorId, async () => {
      try {
        await directory.deleteVisitor(visitorId);
      } catch (error) {
        throw new AccountDeletionUnavailableError({ cause: error });
      }
    });
    await Promise.allSettled(afterwards.map((after) => after()));
  }
}
