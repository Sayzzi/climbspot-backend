import { AscentNotFoundError } from '../domain/ascent-errors.ts';
import type { AscentRepository } from '../domain/ascent-repository.ts';
import type { PersonalAscentTime, PersonalAscentTimes } from '../domain/personal-ascent-times.ts';

/** A signed-in Visitor's own Ascent Times on one Ascent, newest first. */
export class GetMyAscentTimes {
  constructor(
    private readonly repository: AscentRepository,
    private readonly ascentTimes: PersonalAscentTimes,
  ) {}

  /** @throws {AscentNotFoundError} when no Ascent has this id. */
  async execute(visitorId: string, ascentId: string): Promise<PersonalAscentTime[]> {
    if (!(await this.repository.findById(ascentId))) {
      throw new AscentNotFoundError(ascentId);
    }
    return this.ascentTimes.of(visitorId, ascentId);
  }
}
