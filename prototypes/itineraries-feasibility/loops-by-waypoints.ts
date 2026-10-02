// PROTOTYPE — throwaway: Loops through waypoints placed on a circle, radius adjusted to hit the distance.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const here = 'prototypes/itineraries-feasibility';
const cacheDir = join(here, '.cache');
mkdirSync(cacheDir, { recursive: true });
type Point = [number, number, number];
let requests = 0;
let remaining: string | null = null;

async function through(
  profile: string,
  coordinates: [number, number][],
): Promise<{ coords: Point[]; distance: number }> {
  const file = join(
    cacheDir,
    `wp_${profile}_${coordinates.map((c) => c.map((x) => x.toFixed(4)).join(',')).join(';')}.json`,
  );
  if (existsSync(file))
    return JSON.parse(readFileSync(file, 'utf8')) as { coords: Point[]; distance: number };
  await new Promise((r) => setTimeout(r, 1700));
  requests += 1;
  const res = await fetch(`https://api.openrouteservice.org/v2/directions/${profile}/geojson`, {
    method: 'POST',
    headers: { Authorization: process.env.ORS_API_KEY ?? '', 'Content-Type': 'application/json' },
    body: JSON.stringify({ coordinates, elevation: true, radiuses: coordinates.map(() => 1500) }),
  });
  remaining = res.headers.get('x-ratelimit-remaining');
  const json = (await res.json()) as {
    features?: {
      geometry: { coordinates: Point[] };
      properties: { summary: { distance: number } };
    }[];
  };
  if (!res.ok || !json.features?.[0])
    throw new Error(`ORS ${res.status}: ${JSON.stringify(json).slice(0, 200)}`);
  const out = {
    coords: json.features[0].geometry.coordinates,
    distance: json.features[0].properties.summary.distance,
  };
  writeFileSync(file, JSON.stringify(out));
  return out;
}

const gainPerKm = (coords: Point[], distance: number) => {
  // Resample every 100 m and smooth over 3, as in the catalogue.
  const R = 6_371_008.8,
    rad = (d: number) => (d * Math.PI) / 180;
  const d = (a: Point, b: Point) =>
    2 *
    R *
    Math.asin(
      Math.sqrt(
        Math.sin(rad(b[1] - a[1]) / 2) ** 2 +
          Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(rad(b[0] - a[0]) / 2) ** 2,
      ),
    );
  const cum = [0];
  for (let i = 1; i < coords.length; i++) cum.push(cum[i - 1]! + d(coords[i - 1]!, coords[i]!));
  const e: number[] = [];
  let j = 0;
  for (let x = 0; x <= cum.at(-1)!; x += 100) {
    while (j < coords.length - 2 && cum[j + 1]! < x) j++;
    const t = (x - cum[j]!) / Math.max(cum[j + 1]! - cum[j]!, 1e-9);
    e.push(coords[j]![2] + (coords[j + 1]![2] - coords[j]![2]) * t);
  }
  const s = e.map((_, i) => {
    const w = e.slice(Math.max(0, i - 1), i + 2);
    return w.reduce((a, b) => a + b, 0) / w.length;
  });
  let up = 0;
  for (let i = 1; i < s.length; i++) up += Math.max(0, s[i]! - s[i - 1]!);
  return up / (distance / 1000);
};
const reliefOf = (perKm: number) => (perKm < 10 ? 'flat' : perKm <= 25 ? 'rolling' : 'hilly');

const cases = [
  {
    name: 'Annecy — loop 5 km, rolling (running)',
    profile: 'foot-walking',
    lon: 6.129,
    lat: 45.899,
    length: 5000,
    relief: 'rolling',
  },
  {
    name: 'Bédoin — loop 30 km, hilly (road cycling)',
    profile: 'cycling-road',
    lon: 5.1803,
    lat: 44.1243,
    length: 30000,
    relief: 'hilly',
  },
  {
    name: 'Chartres — loop 10 km, flat (running)',
    profile: 'foot-walking',
    lon: 1.489,
    lat: 48.447,
    length: 10000,
    relief: 'flat',
  },
];

const found: Record<string, [number, number][]> = {};
for (const c of cases) {
  const before = requests;
  const tries: string[] = [];
  let hit = false;
  for (const bearing of [0, 120, 240]) {
    let radius = c.length / (2 * Math.PI * 1.25); // roads wind: ~25 % longer than the circle
    for (let attempt = 0; attempt < 3 && !hit; attempt++) {
      const mPerDegLat = 111_195,
        mPerDegLon = 111_195 * Math.cos((c.lat * Math.PI) / 180);
      const centre = [
        c.lon + (radius * Math.sin((bearing * Math.PI) / 180)) / mPerDegLon,
        c.lat + (radius * Math.cos((bearing * Math.PI) / 180)) / mPerDegLat,
      ];
      const wps: [number, number][] = [0, 1, 2].map((k) => {
        const a = ((bearing + 180 + 90 + k * 90) * Math.PI) / 180; // three points around the centre, away from the start
        return [
          centre[0]! + (radius * Math.sin(a)) / mPerDegLon,
          centre[1]! + (radius * Math.cos(a)) / mPerDegLat,
        ];
      });
      const trip = await through(c.profile, [[c.lon, c.lat], ...wps, [c.lon, c.lat]]);
      const perKm = gainPerKm(trip.coords, trip.distance);
      const okLength = trip.distance >= c.length && trip.distance <= c.length * 1.2;
      const ok = okLength && reliefOf(perKm) === c.relief;
      tries.push(
        `b${bearing} r${Math.round(radius)}: ${(trip.distance / 1000).toFixed(1)} km, ${perKm.toFixed(0)} m/km (${reliefOf(perKm)})${ok ? ' ✓' : okLength ? ' (length ok)' : ''}`,
      );
      if (ok) {
        hit = true;
        found[c.name] = trip.coords.map((p) => [p[0], p[1]]);
      }
      if (okLength) break; // right length: only the relief is off, try another bearing
      radius *= (c.length * 1.1) / trip.distance;
    }
    if (hit) break;
  }
  console.log(
    `\n${c.name}\n  requests: ${String(requests - before)} — ${hit ? 'FOUND' : 'not found'}\n  ${tries.join('\n  ')}`,
  );
}
console.log(`\nTotal new ORS requests: ${String(requests)}; remaining today: ${String(remaining)}`);
writeFileSync(join(here, '.cache', 'loops-found.json'), JSON.stringify(found));
