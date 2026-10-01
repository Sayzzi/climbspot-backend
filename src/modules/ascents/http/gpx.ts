import { XMLParser } from 'fast-xml-parser';
import { SyntaxValidator } from 'fast-xml-validator';

import { DomainError } from '../../../shared/domain/domain-error.ts';
import { MAXIMUM_PATH_POINTS } from '../domain/ascent-rules.ts';
import type { Position } from '../domain/position.ts';

export class GpxInvalidError extends DomainError {
  readonly code = 'GPX_INVALID';
  readonly kind = 'invalid';
}

export class GpxEmptyError extends DomainError {
  readonly code = 'GPX_EMPTY';
  readonly kind = 'invalid';
}

export class GpxTooLargeError extends DomainError {
  readonly code = 'GPX_TOO_LARGE';
  readonly kind = 'too_large';
}

interface GpxPoint {
  readonly lat?: string;
  readonly lon?: string;
}

interface GpxDocument {
  readonly gpx?: {
    readonly trk?: readonly {
      readonly trkseg?: readonly { readonly trkpt?: readonly GpxPoint[] }[];
    }[];
    readonly rte?: readonly { readonly rtept?: readonly GpxPoint[] }[];
  };
}

const repeatedElements = new Set(['trk', 'trkseg', 'trkpt', 'rte', 'rtept']);

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  isArray: (name) => repeatedElements.has(name),
});

/**
 * Extracts the 2D path of a GPX file: the first track's points (all segments joined)
 * or, if it has none, the first route's points. Recorded elevations are ignored (ADR 0005).
 */
export function readGpxPath(content: string): Position[] {
  try {
    SyntaxValidator.validate(content);
  } catch (error) {
    throw new GpxInvalidError('The file is not valid XML.', { cause: error });
  }

  const { gpx } = parser.parse(content) as GpxDocument;
  if (gpx === undefined || typeof gpx !== 'object') {
    throw new GpxInvalidError('The file is not a GPX document.');
  }

  const trackPoints = (gpx.trk?.[0]?.trkseg ?? []).flatMap((segment) => segment.trkpt ?? []);
  const points = trackPoints.length > 0 ? trackPoints : (gpx.rte?.[0]?.rtept ?? []);

  if (points.length > MAXIMUM_PATH_POINTS) {
    throw new GpxTooLargeError(
      `The path has ${String(points.length)} points; at most ${String(MAXIMUM_PATH_POINTS)} are accepted.`,
    );
  }

  const path = points.map(toPosition);
  if (
    new Set(path.map(({ latitude, longitude }) => `${String(latitude)},${String(longitude)}`))
      .size < 2
  ) {
    throw new GpxEmptyError('The file has no track or route with at least two distinct points.');
  }

  return path;
}

function toPosition({ lat, lon }: GpxPoint, index: number): Position {
  const latitude = Number(lat);
  const longitude = Number(lon);
  const valid =
    lat !== undefined &&
    lon !== undefined &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180;

  if (!valid) {
    throw new GpxInvalidError(`Point ${String(index + 1)} has no valid latitude and longitude.`);
  }
  return { latitude, longitude };
}
