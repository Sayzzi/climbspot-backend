import { ensureNotTooLong } from '../domain/ascent-eligibility.ts';
import {
  PATH_SIMPLIFICATION_TOLERANCE,
  SAMPLING_SPACING,
  SMOOTHING_WINDOW,
} from '../../../shared/domain/survey/survey-rules.ts';
import type { AscentRepository } from '../domain/ascent-repository.ts';
import type { AscentAddedListener } from '../domain/personal-ascent-times.ts';
import { createAscent, type Ascent } from '../domain/ascent.ts';
import type { ElevationProvider } from '../domain/elevation-provider.ts';
import { buildProfile, smooth } from '../../../shared/domain/survey/elevation-profile.ts';
import { resample, simplify } from '../../../shared/domain/survey/path.ts';
import type { Position } from '../../../shared/domain/position.ts';
import type { Surface } from '../domain/surface.ts';

export interface CreateAscentInput {
  readonly name: string;
  readonly surface: Surface;
  /** 2D path in either direction; any elevation it came with has already been dropped. */
  readonly path: readonly Position[];
  /** The signed-in Visitor adding it. */
  readonly contributorId: string;
}

export interface CreateAscentDependencies {
  readonly repository: AscentRepository;
  readonly elevationProvider: ElevationProvider;
  readonly newId: () => string;
  readonly now: () => Date;
  readonly onAscentAdded: AscentAddedListener;
}

/** Surveys a path on the terrain model and catalogues it as an Ascent (ADR 0005). */
export class CreateAscent {
  constructor(private readonly dependencies: CreateAscentDependencies) {}

  async execute({ name, surface, path, contributorId }: CreateAscentInput): Promise<Ascent> {
    const { repository, elevationProvider, newId, now } = this.dependencies;

    ensureNotTooLong(path);

    const samples = resample(path, SAMPLING_SPACING);
    const elevations = smooth(
      await elevationProvider.elevationsAt(samples.map((sample) => sample.position)),
      SMOOTHING_WINDOW,
    );

    const ascent = createAscent({
      id: newId(),
      name,
      surface,
      path: simplify(path, PATH_SIMPLIFICATION_TOLERANCE),
      profile: buildProfile(samples, elevations),
      contributorId,
      createdAt: now(),
    });

    await repository.save(ascent);
    try {
      await this.dependencies.onAscentAdded(ascent);
    } catch {
      // The Ascent is catalogued; Ascent Times missed now are a lesser loss than failing it.
    }
    return ascent;
  }
}
