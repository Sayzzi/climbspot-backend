import type { SecondFactors } from '../domain/identity.ts';

/** How long an answer is trusted before asking again. */
const FRESH_MS = 60_000;

/**
 * Remembers who has a second factor for a minute, sparing a call to the identity
 * provider on every request (ADR 0009). Past that minute, a failure to ask stands.
 */
export function rememberedSecondFactors(
  inner: SecondFactors,
  now: () => number = Date.now,
): SecondFactors {
  const answers = new Map<string, { readonly has: boolean; readonly at: number }>();
  return {
    has: async (visitorId) => {
      const known = answers.get(visitorId);
      if (known && now() - known.at < FRESH_MS) {
        return known.has;
      }
      const has = await inner.has(visitorId);
      answers.set(visitorId, { has, at: now() });
      return has;
    },
  };
}
