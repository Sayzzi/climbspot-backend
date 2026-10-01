import { surfaces, type Surface } from './surface.ts';

/** Ways of travelling an Ascent. */
export const activities = [
  'running',
  'trail_running',
  'road_cycling',
  'gravel_cycling',
  'mountain_biking',
] as const;

export type Activity = (typeof activities)[number];

/** The single source of truth linking Surfaces to Activities (ADR 0007). */
const activitiesBySurface: Record<Surface, readonly Activity[]> = {
  paved: ['running', 'road_cycling'],
  gravel: ['running', 'trail_running', 'gravel_cycling', 'mountain_biking'],
  trail: ['trail_running', 'mountain_biking'],
};

export function activitiesFor(surface: Surface): readonly Activity[] {
  return activitiesBySurface[surface];
}

/** Surfaces that allow at least one of the Activities: the reverse of `activitiesFor`. */
export function surfacesAllowing(wanted: readonly Activity[]): Surface[] {
  return surfaces.filter((surface) =>
    activitiesFor(surface).some((activity) => wanted.includes(activity)),
  );
}
