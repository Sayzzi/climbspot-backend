/**
 * Erases what one part of ClimbSpot keeps about a signed-in Visitor when their account
 * is deleted. Each module provides its own, wired together at the composition root.
 */
export interface VisitorDataEraser {
  erase(visitorId: string): Promise<void>;
}
