import { ensureNotTooLong } from '../domain/ascent-eligibility.ts';
import { AscentCreationDisabledError } from '../domain/ascent-errors.ts';
import { SAMPLING_SPACING, SMOOTHING_WINDOW } from '../domain/ascent-rules.ts';
import type { AscentRepository } from '../domain/ascent-repository.ts';
import { createAscent, type Ascent } from '../domain/ascent.ts';
import type { ElevationProvider } from '../domain/elevation-provider.ts';
import { buildProfile, smooth } from '../domain/elevation-profile.ts';
import { resample } from '../domain/path.ts';
import type { Position } from '../domain/position.ts';
import type { Surface } from '../domain/surface.ts';

export interface CreateAscentInput {
  readonly name: string;
  readonly surface: Surface;
  /** 2D path in either direction; any elevation it came with has already been dropped. */
  readonly path: readonly Position[];
}

export interface CreateAscentDependencies {
  readonly repository: AscentRepository;
  readonly elevationProvider: ElevationProvider;
  /** Temporary guard until Contributors are authenticated. */
  readonly creationEnabled: boolean;
  readonly newId: () => string;
  readonly now: () => Date;
}

/** Surveys a path on the terrain model and catalogues it as an Ascent (ADR 0005). */
export class CreateAscent {
  constructor(private readonly dependencies: CreateAscentDependencies) {}

  /** Lets callers refuse early, before receiving an upload. */
  ensureEnabled(): void {
    if (!this.dependencies.creationEnabled) {
      throw new AscentCreationDisabledError();
    }
  }

  async execute({ name, surface, path }: CreateAscentInput): Promise<Ascent> {
    const { repository, elevationProvider, newId, now } = this.dependencies;

    this.ensureEnabled();
    ensureNotTooLong(path);

    const positions = resample(path, SAMPLING_SPACING);
    const elevations = smooth(await elevationProvider.elevationsAt(positions), SMOOTHING_WINDOW);

    const ascent = createAscent({
      id: newId(),
      name,
      surface,
      profile: buildProfile(positions, elevations),
      createdAt: now(),
    });

    await repository.save(ascent);
    return ascent;
  }
}
