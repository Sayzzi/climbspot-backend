/** Where signed-in Visitors' identities live (Supabase Auth, ADR 0009). */
export interface AccountDirectory {
  /** Deletes the Visitor's identity, so that they can no longer sign in as themselves. */
  deleteVisitor(visitorId: string): Promise<void>;
}
