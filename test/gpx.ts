export interface GpxPoint {
  readonly latitude: number;
  readonly longitude: number;
  /** Optional recorded elevation, which ClimbSpot must ignore. */
  readonly elevation?: number;
}

const header = '<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="test">';

function point(tag: string, { latitude, longitude, elevation }: GpxPoint): string {
  const ele = elevation === undefined ? '' : `<ele>${String(elevation)}</ele>`;
  return `<${tag} lat="${String(latitude)}" lon="${String(longitude)}">${ele}</${tag}>`;
}

/** A GPX file with one track made of the given segments. */
export function gpxTrack(...segments: readonly (readonly GpxPoint[])[]): string {
  const body = segments
    .map((segment) => `<trkseg>${segment.map((p) => point('trkpt', p)).join('')}</trkseg>`)
    .join('');
  return `${header}<trk><name>Test</name>${body}</trk></gpx>`;
}

/** A GPX file with one planned route and no track. */
export function gpxRoute(points: readonly GpxPoint[]): string {
  return `${header}<rte><name>Test</name>${points.map((p) => point('rtept', p)).join('')}</rte></gpx>`;
}
