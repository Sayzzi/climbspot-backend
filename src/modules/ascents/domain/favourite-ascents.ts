/** The Ascents each signed-in Visitor marked to find them again; only they see theirs. */
export interface FavouriteAscents {
  /** Marks the Ascent for the Visitor; marking it again changes nothing. */
  mark(visitorId: string, ascentId: string, at: Date): Promise<void>;
  /** Unmarks it; nothing happens when it was not marked. */
  unmark(visitorId: string, ascentId: string): Promise<void>;
  /** Which of these Ascents are the Visitor's favourites. */
  among(visitorId: string, ascentIds: readonly string[]): Promise<ReadonlySet<string>>;
}
