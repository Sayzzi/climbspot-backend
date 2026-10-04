import type { SecondFactors } from '../domain/identity.ts';

/** How long an answer is trusted before asking again. */
const FRESH_MS = 60_000;
/** How long an answer still serves when asking again fails. */
const FALLBACK_MS = 10 * 60_000;

interface Answer {
  readonly has: boolean;
  readonly at: number;
}

/**
 * Remembers who has a second factor for a minute, sparing a call to the identity
 * provider on every request; when asking again fails, an answer of the last ten
 * minutes still serves, and with none the failure stands.
 */
export function rememberedSecondFactors(
  inner: SecondFactors,
  now: () => number = Date.now,
): SecondFactors {
  const answers = new Map<string, Answer>();
  return {
    has: async (visitorId) => {
      const known = answers.get(visitorId);
      if (known && now() - known.at < FRESH_MS) {
        return known.has;
      }
      try {
        const has = await inner.has(visitorId);
        answers.set(visitorId, { has, at: now() });
        return has;
      } catch (error) {
        if (known && now() - known.at < FALLBACK_MS) {
          return known.has;
        }
        throw error;
      }
    },
  };
}
