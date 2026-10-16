import type { AscentRepository } from '../domain/ascent-repository.ts';
import type { AscentSummary } from '../domain/ascent.ts';
import type { AscentTimeSummary, PersonalAscentTimes } from '../domain/personal-ascent-times.ts';

/** An Ascent a Visitor went up, with their Ascent Times on it. */
export interface AscentRunResult {
  readonly ascent: AscentSummary;
  readonly myAscentTimes: AscentTimeSummary;
}

/** Lists the Ascents a signed-in Visitor went up, the latest run first. */
export class ListAscentsRun {
  constructor(
    private readonly repository: AscentRepository,
    private readonly ascentTimes: PersonalAscentTimes,
  ) {}

  async execute(visitorId: string): Promise<AscentRunResult[]> {
    const times = await this.ascentTimes.ranBy(visitorId);
    const summaries = new Map(
      (await this.repository.findSummaries([...times.keys()])).map((ascent) => [ascent.id, ascent]),
    );
    return [...times].flatMap(([id, myAscentTimes]) => {
      const ascent = summaries.get(id);
      return ascent ? [{ ascent, myAscentTimes }] : [];
    });
  }
}
