/** Erases an account and everything ClimbSpot keeps about its Visitor, all or nothing. */
export interface AccountErasure {
  /**
   * Erases everything, then runs `confirm`: when anything fails, `confirm` included,
   * nothing is erased.
   */
  erase(visitorId: string, confirm: () => Promise<void>): Promise<void>;
}
