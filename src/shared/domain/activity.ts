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
export const runningActivities = [
  'running',
  'trail_running',
] as const satisfies readonly Activity[];

export type RunningActivity = (typeof runningActivities)[number];

export function isRunning(activity: Activity): activity is RunningActivity {
  return (runningActivities as readonly Activity[]).includes(activity);
}
