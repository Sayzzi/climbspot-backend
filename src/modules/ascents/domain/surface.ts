/** The dominant ground type of an Ascent. */
export const surfaces = ['paved', 'gravel', 'trail'] as const;

export type Surface = (typeof surfaces)[number];
