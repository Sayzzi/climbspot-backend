import { DomainError } from '../../../shared/domain/domain-error.ts';
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

export class AscentCreationDisabledError extends DomainError {
  readonly code = 'ASCENT_CREATION_DISABLED';
  readonly kind = 'forbidden';

  constructor() {
    super('Creating Ascents is disabled on this server.');
  }
}

/** Surveys a path on the terrain model and catalogues it as an Ascent (ADR 0005). */
export class CreateAscent {
  constructor(private readonly dependencies: CreateAscentDependencies) {}

  async execute({ name, surface, path }: CreateAscentInput): Promise<Ascent> {
    const { repository, elevationProvider, creationEnabled, newId, now } = this.dependencies;

    if (!creationEnabled) {
      throw new AscentCreationDisabledError();
    }

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
