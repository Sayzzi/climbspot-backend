import type { Ascent } from './ascent.ts';

export interface AscentRepository {
  save(ascent: Ascent): Promise<void>;
  findById(id: string): Promise<Ascent | undefined>;
}
