import type { AfterErasure } from './visitor-data-eraser.ts';

/** Erases an account and everything ClimbSpot keeps about its Visitor, all or nothing. */
export interface AccountErasure {
  /**
   * Erases everything, then runs `confirm`: when anything fails, `confirm` included,
   * nothing is erased.
   * @returns What to do now that the account is gone.
   */
  erase(visitorId: string, confirm: () => Promise<void>): Promise<AfterErasure[]>;
}
