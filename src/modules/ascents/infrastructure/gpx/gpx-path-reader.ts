import { XMLParser } from 'fast-xml-parser';
import { SyntaxValidator } from 'fast-xml-validator';

import { GpxEmptyError, GpxInvalidError, GpxTooLargeError } from '../../domain/ascent-errors.ts';
import { MAXIMUM_PATH_POINTS } from '../../domain/ascent-rules.ts';
import type { PathReader } from '../../domain/path-reader.ts';
import type { Position } from '../../domain/position.ts';

interface GpxPoint {
  readonly lat?: string;
  readonly lon?: string;
}

interface GpxContent {
  readonly trk?: readonly {
    readonly trkseg?: readonly { readonly trkpt?: readonly GpxPoint[] }[];
  }[];
  readonly rte?: readonly { readonly rtept?: readonly GpxPoint[] }[];
}

/** An empty `<gpx/>` element is parsed as an empty string. */
interface GpxDocument {
  readonly gpx?: GpxContent | '';
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
export const readGpxPath: PathReader = (content) => {
  try {
    SyntaxValidator.validate(content);
  } catch (error) {
    throw new GpxInvalidError('The file is not valid XML.', { cause: error });
  }

  const { gpx } = parser.parse(content) as GpxDocument;
  if (gpx === undefined) {
    throw new GpxInvalidError('The file is not a GPX document.');
  }

  const points = pathPoints(gpx === '' ? {} : gpx);
  if (points.length > MAXIMUM_PATH_POINTS) {
    throw new GpxTooLargeError(
      `The path has ${String(points.length)} points; at most ${String(MAXIMUM_PATH_POINTS)} are accepted.`,
    );
  }

  const path = points.map(toPosition);
  const distinct = new Set(
    path.map(({ latitude, longitude }) => `${String(latitude)},${String(longitude)}`),
  );
  if (distinct.size < 2) {
    throw new GpxEmptyError('The file has no track or route with at least two distinct points.');
  }

  return path;
};

function pathPoints({ trk, rte }: GpxContent): readonly GpxPoint[] {
  const trackPoints = (trk?.[0]?.trkseg ?? []).flatMap((segment) => segment.trkpt ?? []);
  return trackPoints.length > 0 ? trackPoints : (rte?.[0]?.rtept ?? []);
}

function toPosition({ lat, lon }: GpxPoint, index: number): Position {
  const latitude = toCoordinate(lat, 90);
  const longitude = toCoordinate(lon, 180);

  if (latitude === undefined || longitude === undefined) {
    throw new GpxInvalidError(`Point ${String(index + 1)} has no valid latitude and longitude.`);
  }
  return { latitude, longitude };
}

/** Parses a decimal-degree attribute; blank, non-numeric or out-of-range values are invalid. */
function toCoordinate(value: string | undefined, limit: number): number | undefined {
  if (value === undefined || value.trim() === '') {
    return undefined;
  }
  const coordinate = Number(value);
  return Number.isFinite(coordinate) && Math.abs(coordinate) <= limit ? coordinate : undefined;
}
