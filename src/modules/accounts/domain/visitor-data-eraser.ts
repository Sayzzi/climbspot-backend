/**
 * What to do once the account is gone for good, outside ClimbSpot (e.g. withdrawing
 * its access at another service): never undone, so never done before. Failures are
 * ignored: ClimbSpot keeps nothing either way.
 */
export type AfterErasure = () => Promise<void>;

/**
 * Erases what one part of ClimbSpot keeps about a signed-in Visitor when their account
 * is deleted. Each module provides its own, wired together at the composition root;
 * all of them erase within one transaction.
 */
export interface VisitorDataEraser {
  /** @returns What to do once the account is gone, if anything. */
  erase(visitorId: string): Promise<AfterErasure | undefined>;
}
