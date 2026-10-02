// PROTOTYPE — throwaway feasibility experiment. Not production code.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const here = 'prototypes/itineraries-feasibility';
const cacheDir = join(here, '.cache');
mkdirSync(cacheDir, { recursive: true });

type Point = [number, number, number]; // lon, lat, ele
interface Trip {
  coords: Point[];
  distance: number;
}

let requests = 0;
let remaining: string | null = null;

async function roundTrip(
  profile: string,
  lon: number,
  lat: number,
  length: number,
  seed: number,
): Promise<Trip> {
  const key = `${profile}_${lon}_${lat}_${Math.round(length)}_${seed}.json`;
  const file = join(cacheDir, key);
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8')) as Trip;
  await new Promise((r) => setTimeout(r, 1700)); // stay under 40 requests/minute
  requests += 1;
  const res = await fetch(`https://api.openrouteservice.org/v2/directions/${profile}/geojson`, {
    method: 'POST',
    headers: { Authorization: process.env.ORS_API_KEY ?? '', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      coordinates: [[lon, lat]],
      elevation: true,
      options: { round_trip: { length: Math.round(length), points: 4, seed } },
    }),
  });
  remaining = res.headers.get('x-ratelimit-remaining');
  const json = (await res.json()) as {
    features?: {
      geometry: { coordinates: Point[] };
      properties: { summary: { distance: number } };
    }[];
    error?: unknown;
  };
  if (!res.ok || !json.features?.[0])
    throw new Error(`ORS ${res.status}: ${JSON.stringify(json).slice(0, 200)}`);
  const f = json.features[0];
  const trip = { coords: f.geometry.coordinates, distance: f.properties.summary.distance };
  writeFileSync(file, JSON.stringify(trip));
  return trip;
}

const R = 6_371_008.8;
const rad = (d: number) => (d * Math.PI) / 180;
function dist(a: Point, b: Point) {
  const h =
    Math.sin(rad(b[1] - a[1]) / 2) ** 2 +
    Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(rad(b[0] - a[0]) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Same treatment as the catalogue: resample every 100 m, smooth over 3 samples. */
function profileOf(coords: Point[]) {
  const cum = [0];
  for (let i = 1; i < coords.length; i++) cum.push(cum[i - 1]! + dist(coords[i - 1]!, coords[i]!));
  const total = cum.at(-1)!;
  const pts: { d: number; e: number; lon: number; lat: number }[] = [];
  let j = 0;
  for (let d = 0; d <= total; d += 100) {
    while (j < coords.length - 2 && cum[j + 1]! < d) j++;
    const t = (d - cum[j]!) / Math.max(cum[j + 1]! - cum[j]!, 1e-9);
    const a = coords[j]!,
      b = coords[j + 1]!;
    pts.push({
      d,
      e: a[2] + (b[2] - a[2]) * t,
      lon: a[0] + (b[0] - a[0]) * t,
      lat: a[1] + (b[1] - a[1]) * t,
    });
  }
  const sm = pts.map((p, i) => {
    const w = pts.slice(Math.max(0, i - 1), Math.min(pts.length, i + 2));
    return { ...p, e: w.reduce((s, q) => s + q.e, 0) / w.length };
  });
  return { pts: sm, total };
}

const gainPerKm = (pts: { e: number }[], total: number) => {
  let up = 0;
  for (let i = 1; i < pts.length; i++) up += Math.max(0, pts[i]!.e - pts[i - 1]!.e);
  return up / (total / 1000);
};

interface UphillResult {
  length: number;
  gradient: number;
  gain: number;
  fromRequest: number;
  exact: boolean;
  line: [number, number][];
  seed: number;
}

function bestUphill(
  pts: { d: number; e: number; lon: number; lat: number }[],
  L: number,
  gmin: number,
  gmax: number,
  origin: Point,
  seed: number,
): UphillResult | undefined {
  let best: (UphillResult & { score: number }) | undefined;
  for (const seq of [pts, [...pts].reverse().map((p, i, arr) => ({ ...p, d: arr[0]!.d - p.d }))]) {
    for (let i = 0; i < seq.length; i++) {
      for (
        let k = i + Math.ceil(L / 100);
        k < seq.length && seq[k]!.d - seq[i]!.d <= L * 1.2;
        k++
      ) {
        const len = seq[k]!.d - seq[i]!.d;
        if (len < L) continue;
        const gain = seq[k]!.e - seq[i]!.e;
        if (gain <= 0) continue;
        let lost = 0;
        for (let m = i + 1; m <= k; m++) lost += Math.max(0, seq[m - 1]!.e - seq[m]!.e);
        if (lost > Math.max(10, 0.1 * gain)) continue;
        const g = gain / len;
        const off = g < gmin ? gmin - g : g > gmax ? g - gmax : 0;
        const fromRequest = dist(origin, [seq[i]!.lon, seq[i]!.lat, 0]);
        const score = off * 1000 + fromRequest / 10_000;
        if (!best || score < best.score) {
          best = {
            score,
            length: len,
            gradient: g,
            gain,
            fromRequest,
            exact: off === 0,
            seed,
            line: seq.slice(i, k + 1).map((p) => [p.lon, p.lat]),
          };
        }
      }
    }
  }
  return best;
}

interface Case {
  name: string;
  kind: 'uphill' | 'loop';
  profile: string;
  lon: number;
  lat: number;
  length: number;
  gmin?: number;
  gmax?: number;
  relief?: 'flat' | 'rolling' | 'hilly';
  tries: number;
}

const cases: Case[] = [
  {
    name: 'Annecy — uphill 2–5 % over 3 km (trail running)',
    kind: 'uphill',
    profile: 'foot-hiking',
    lon: 6.129,
    lat: 45.899,
    length: 3000,
    gmin: 0.02,
    gmax: 0.05,
    tries: 6,
  },
  {
    name: 'Bédoin — uphill 6–9 % over 5 km (road cycling)',
    kind: 'uphill',
    profile: 'cycling-road',
    lon: 5.1803,
    lat: 44.1243,
    length: 5000,
    gmin: 0.06,
    gmax: 0.09,
    tries: 6,
  },
  {
    name: 'Chartres (flat) — uphill 2–5 % over 2 km (running)',
    kind: 'uphill',
    profile: 'foot-walking',
    lon: 1.489,
    lat: 48.447,
    length: 2000,
    gmin: 0.02,
    gmax: 0.05,
    tries: 4,
  },
  {
    name: 'Annecy — loop 5 km, rolling (running)',
    kind: 'loop',
    profile: 'foot-walking',
    lon: 6.129,
    lat: 45.899,
    length: 5000,
    relief: 'rolling',
    tries: 5,
  },
  {
    name: 'Bédoin — loop 30 km, hilly (road cycling)',
    kind: 'loop',
    profile: 'cycling-road',
    lon: 5.1803,
    lat: 44.1243,
    length: 30000,
    relief: 'hilly',
    tries: 5,
  },
  {
    name: 'Chartres — loop 10 km, flat (running)',
    kind: 'loop',
    profile: 'foot-walking',
    lon: 1.489,
    lat: 48.447,
    length: 10000,
    relief: 'flat',
    tries: 4,
  },
];

const reliefOf = (perKm: number) => (perKm < 10 ? 'flat' : perKm <= 25 ? 'rolling' : 'hilly');

const report: {
  c: Case;
  lines: { coords: [number, number][]; label: string }[];
  summary: string;
  requests: number;
}[] = [];

for (const c of cases) {
  const before = requests;
  const origin: Point = [c.lon, c.lat, 0];
  const lines: { coords: [number, number][]; label: string }[] = [];
  let summary = '';
  if (c.kind === 'uphill') {
    const found: UphillResult[] = [];
    for (let seed = 1; seed <= c.tries; seed++) {
      const trip = await roundTrip(c.profile, c.lon, c.lat, c.length * 2.5, seed);
      const { pts } = profileOf(trip.coords);
      const r = bestUphill(pts, c.length, c.gmin!, c.gmax!, origin, seed);
      if (r) found.push(r);
    }
    found.sort(
      (a, b) =>
        Number(b.exact) - Number(a.exact) ||
        Math.abs(a.gradient - (c.gmin! + c.gmax!) / 2) -
          Math.abs(b.gradient - (c.gmin! + c.gmax!) / 2),
    );
    const top = found.slice(0, 3);
    summary =
      top.length === 0
        ? 'nothing found'
        : top
            .map(
              (r) =>
                `${r.exact ? '✓' : '≈'} ${(r.length / 1000).toFixed(2)} km @ ${(r.gradient * 100).toFixed(1)} % (+${Math.round(r.gain)} m), start ${(r.fromRequest / 1000).toFixed(1)} km away`,
            )
            .join(' | ');
    for (const r of top)
      lines.push({
        coords: r.line,
        label: `${(r.length / 1000).toFixed(2)} km @ ${(r.gradient * 100).toFixed(1)} %`,
      });
  } else {
    let request = c.length;
    const results: string[] = [];
    let hit: string | undefined;
    for (let seed = 1; seed <= c.tries && !hit; seed++) {
      const trip = await roundTrip(c.profile, c.lon, c.lat, request, seed);
      const { pts, total } = profileOf(trip.coords);
      const perKm = gainPerKm(pts, total);
      const okLength = total >= c.length && total <= c.length * 1.2;
      const okRelief = reliefOf(perKm) === c.relief;
      const line = `${(total / 1000).toFixed(1)} km asked ${(request / 1000).toFixed(1)}, ${perKm.toFixed(0)} m/km (${reliefOf(perKm)})${okLength && okRelief ? ' ✓' : ''}`;
      results.push(line);
      lines.push({ coords: trip.coords.map((p) => [p[0], p[1]]), label: line });
      if (okLength && okRelief) hit = line;
      // Calibrate: ORS overshoots or undershoots the asked length; aim at +10 % next time.
      request = Math.max(500, request * ((c.length * 1.1) / total));
    }
    summary = `${hit ? 'FOUND' : 'not found'} after ${String(results.length)} tries: ${results.join(' | ')}`;
  }
  const used = requests - before;
  report.push({ c, lines, summary, requests: used });
  console.log(`\n${c.name}\n  requests: ${String(used)}\n  ${summary}`);
}
console.log(`\nTotal new ORS requests: ${String(requests)}; remaining today: ${String(remaining)}`);

const colours = ['#c62f2f', '#1f3a2e', '#5f6d40', '#b07d10', '#4a5ab0'];
const html = `<!doctype html><html><head><meta charset="utf-8"><title>PROTOTYPE itineraries</title>
<link href="https://unpkg.com/maplibre-gl@5/dist/maplibre-gl.css" rel="stylesheet"><script src="https://unpkg.com/maplibre-gl@5/dist/maplibre-gl.js"></script>
<style>body{margin:0;font:15px system-ui;display:grid;grid-template-columns:420px 1fr;height:100vh}aside{overflow:auto;padding:16px;background:#e9ece6}#map{height:100vh}button{display:block;width:100%;text-align:left;margin:0 0 12px;padding:10px;border:1px solid #1f3a2e33;border-radius:8px;background:#fff;cursor:pointer}small{color:#5c6057}</style></head>
<body><aside><h2>PROTOTYPE — itineraries feasibility</h2>${report.map((r, i) => `<button data-i="${i}"><b>${r.c.name}</b><br><small>${r.requests} ORS requests</small><br>${r.summary}</button>`).join('')}</aside><div id="map"></div>
<script>const data=${JSON.stringify(report.map((r) => ({ origin: [r.c.lon, r.c.lat], lines: r.lines })))};const colours=${JSON.stringify(colours)};
const map=new maplibregl.Map({container:'map',style:'https://tiles.openfreemap.org/styles/liberty',center:[4,46],zoom:5});let marker;
function show(i){const d=data[i];for(let k=0;k<5;k++){if(map.getLayer('l'+k))map.removeLayer('l'+k);if(map.getSource('l'+k))map.removeSource('l'+k);}
d.lines.slice(0,5).forEach((l,k)=>{map.addSource('l'+k,{type:'geojson',data:{type:'Feature',geometry:{type:'LineString',coordinates:l.coords}}});map.addLayer({id:'l'+k,type:'line',source:'l'+k,paint:{'line-color':colours[k],'line-width':k===0?6:3,'line-opacity':k===0?1:0.6}});});
marker&&marker.remove();marker=new maplibregl.Marker({color:'#f2c230'}).setLngLat(d.origin).addTo(map);
const all=d.lines.flatMap(l=>l.coords).concat([d.origin]);const b=all.reduce((b,c)=>b.extend(c),new maplibregl.LngLatBounds(all[0],all[0]));map.fitBounds(b,{padding:40});}
document.querySelectorAll('button').forEach(b=>b.onclick=()=>show(+b.dataset.i));map.on('load',()=>show(0));</script></body></html>`;
writeFileSync(join(here, 'report.html'), html);
console.log(`Report: ${join(here, 'report.html')}`);
