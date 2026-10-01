/** Difficulty bands, from easiest to hardest (ADR 0006). */
export const categories = ['uncategorized', 'cat4', 'cat3', 'cat2', 'cat1', 'hc'] as const;

export type Category = (typeof categories)[number];

/** Lowest Difficulty Score of each Category, hardest first. */
const thresholds: readonly (readonly [Category, number])[] = [
  ['hc', 80_000],
  ['cat1', 64_000],
  ['cat2', 32_000],
  ['cat3', 16_000],
  ['cat4', 8_000],
];

export function categoryFor(difficultyScore: number): Category {
  return thresholds.find(([, minimum]) => difficultyScore >= minimum)?.[0] ?? 'uncategorized';
}
