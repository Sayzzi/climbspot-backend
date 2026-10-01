import { XMLParser } from 'fast-xml-parser';

import type { Position } from '../domain/position.ts';

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
  const { gpx } = parser.parse(content) as GpxDocument;
  const trackPoints = (gpx?.trk?.[0]?.trkseg ?? []).flatMap((segment) => segment.trkpt ?? []);
  const points = trackPoints.length > 0 ? trackPoints : (gpx?.rte?.[0]?.rtept ?? []);

  return points.map((point) => ({ latitude: Number(point.lat), longitude: Number(point.lon) }));
}
