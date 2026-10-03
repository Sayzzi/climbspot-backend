/** Ways of travelling: what a Visitor picks, and what an Ascent's Surface allows. */
export const activities = [
  'running',
  'trail_running',
  'road_cycling',
  'gravel_cycling',
  'mountain_biking',
] as const;

export type Activity = (typeof activities)[number];

/** Activities that are running: running effort and times only make sense for them. */
const runningActivities: readonly Activity[] = ['running', 'trail_running'];

export function isRunning(activity: Activity): boolean {
  return runningActivities.includes(activity);
}
