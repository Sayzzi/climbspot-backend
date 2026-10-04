import type { AscentPath } from '../../../shared/domain/ascent-times.ts';
import type { AscentCatalogue } from '../domain/ascent-catalogue.ts';
import { ascentTimesOn } from '../domain/ascent-time.ts';
import type { AscentTimeRepository } from '../domain/ascent-time-repository.ts';
import { boundsOf, type RecordedRun } from '../domain/recorded-run.ts';
import type { RecordedRunRepository } from '../domain/recorded-run-repository.ts';

export interface AscentTimesDependencies {
  readonly times: AscentTimeRepository;
  readonly runs: RecordedRunRepository;
  readonly catalogue: AscentCatalogue;
}

/** Finding Ascent Times in Recorded Runs, as runs are imported and Ascents are added. */
export class AscentTimes {
  constructor(private readonly dependencies: AscentTimesDependencies) {}

  /** Finds the Ascent Times of a newly imported Recorded Run on the catalogue. */
  async inRun(run: RecordedRun): Promise<void> {
    const { times, catalogue } = this.dependencies;
    const bounds = boundsOf(run.track);
    if (!bounds) {
      return;
    }
    const ascents = await catalogue.startingWithin(bounds);
    await times.saveAll(ascents.flatMap((ascent) => ascentTimesOn(run, ascent)));
  }

  eraseAllOf(visitorId: string): Promise<void> {
    return this.dependencies.times.deleteAllOf(visitorId);
  }

  /** Finds the Ascent Times of a newly added Ascent in every stored Recorded Run. */
  async onAscent(ascent: AscentPath): Promise<void> {
    const { times, runs } = this.dependencies;
    const start = ascent.path[0];
    if (!start) {
      return;
    }
    const passing = await runs.passingNear(start);
    await times.saveAll(passing.flatMap((run) => ascentTimesOn(run, ascent)));
  }
}
