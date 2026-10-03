/** Minetti's energy cost of running at Gradient `i`, J/kg/m (validity ±45 %). */
const minetti = (i: number) =>
  155.4 * i ** 5 - 30.4 * i ** 4 - 43.3 * i ** 3 + 46.3 * i ** 2 + 19.5 * i + 3.6;

/** The Flat-Equivalent Distance of a profile, computed by hand from its stretches. */
export function flatEquivalent(
  profile: readonly { distance: number; elevation: number }[],
  descentFloor: number,
): number {
  let total = 0;
  for (const [index, to] of profile.entries()) {
    const from = profile[index - 1];
    if (from === undefined) continue;
    const length = to.distance - from.distance;
    const gradient = Math.max(-0.45, Math.min(0.45, (to.elevation - from.elevation) / length));
    total += length * Math.max(descentFloor, minetti(gradient) / minetti(0));
  }
  return total;
}
