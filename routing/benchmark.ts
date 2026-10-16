/*
 * Calibrates the Itinerary search on real ways (ADR 0008): runs the use cases against
 * the self-hosted OpenRouteService for a few towns and records what they propose.
 *
 *   pnpm bench:itineraries <label>
 *
 * Routing responses are recorded in routing/.benchmark/responses.json and replayed on
 * later runs, so that two versions of the search are compared on the same answers
 * (and without the routing engine once recorded). Results go to
 * routing/.benchmark/<label>.json. Replayed timings are not end-to-end latencies.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

import { FindUphillItineraries } from '../src/modules/itineraries/application/find-uphill-itineraries.ts';
import { GenerateLoops } from '../src/modules/itineraries/application/generate-loops.ts';
import { retracedShare } from '../src/modules/itineraries/domain/loop-search.ts';
import { OpenRouteServiceRoutingProvider } from '../src/modules/itineraries/infrastructure/open-route-service-routing-provider.ts';
import type { Position } from '../src/shared/domain/position.ts';
import { distanceBetween } from '../src/shared/domain/survey/geodesy.ts';

const TOWNS: Record<string, Position> = {
  Tournai: { latitude: 50.606, longitude: 3.388 },
  Lille: { latitude: 50.6366, longitude: 3.0635 },
  Annecy: { latitude: 45.899, longitude: 6.129 },
  Chamonix: { latitude: 45.9237, longitude: 6.8694 },
};
const SCENARIOS = ['flat', 'hilly', 'uphill'] as const;
const LOOP_DISTANCE = 10_000;
const UPHILL_LENGTH = 1000;
/** Loops must end this close to where they were asked for, in metres. */
const LOOP_END_TOLERANCE = 300;

const directory = new URL('./.benchmark/', import.meta.url);
const cachePath = new URL('responses.json', directory);
mkdirSync(directory, { recursive: true });
const recorded = (
  existsSync(cachePath) ? JSON.parse(readFileSync(cachePath, 'utf8')) : {}
) as Record<string, { status: number; body: string }>;

const percent = (share: number, decimals = 1) => Number((100 * share).toFixed(decimals));

const rows = [];
for (const [town, start] of Object.entries(TOWNS)) {
  for (const scenario of SCENARIOS) {
    let calls = 0;
    let misses = 0;
    const routing = new OpenRouteServiceRoutingProvider({
      baseUrl: process.env.ORS_URL ?? 'http://localhost:8080/ors',
      fetch: async (input, init) => {
        calls += 1;
        const url = input instanceof Request ? input.url : input.toString();
        const body = typeof init?.body === 'string' ? init.body : 'undefined';
        const key = `${url} ${body}`;
        let response = recorded[key];
        if (response === undefined) {
          const live = await fetch(input, init);
          response = { status: live.status, body: await live.text() };
          recorded[key] = response;
          writeFileSync(cachePath, JSON.stringify(recorded));
        }
        if (response.status === 404) misses += 1;
        return new Response(response.body, { status: response.status });
      },
    });

    const began = performance.now();
    const asked = scenario === 'uphill' ? UPHILL_LENGTH : LOOP_DISTANCE;
    const proposals =
      scenario === 'uphill'
        ? await new FindUphillItineraries(routing).execute({
            start,
            radius: 10_000,
            length: UPHILL_LENGTH,
            minGradient: 0.03,
            maxGradient: 0.06,
            activity: 'running',
          })
        : await new GenerateLoops(routing).execute({
            start,
            distance: LOOP_DISTANCE,
            relief: scenario,
            activity: 'running',
          });

    for (const proposal of proposals) {
      const { length } = proposal.measurements;
      if (length < asked - 0.01 || length > asked * 1.2 + 0.01) {
        throw new Error(
          `${town} ${scenario}: a proposal breaks the length rule (${String(length)} m)`,
        );
      }
      const ends = [proposal.path[0], proposal.path.at(-1)];
      if (
        scenario !== 'uphill' &&
        ends.some((end) => end === undefined || distanceBetween(start, end) > LOOP_END_TOLERANCE)
      ) {
        throw new Error(`${town} ${scenario}: a Loop ends too far from its start`);
      }
    }

    const row = {
      town,
      scenario,
      calls,
      misses,
      ms: Math.round(performance.now() - began),
      exact: proposals.filter((proposal) => proposal.exact).length,
      proposals: proposals.map((proposal) => ({
        length: Math.round(proposal.measurements.length),
        gradient: percent(proposal.measurements.averageGradient, 2),
        gain: Math.round(proposal.measurements.heightGained),
        retracedPercent: percent(retracedShare(proposal.path)),
        exact: proposal.exact,
      })),
    };
    rows.push(row);
    process.stdout.write(`${JSON.stringify(row)}\n`);
  }
}

const label = process.argv[2] ?? 'latest';
writeFileSync(new URL(`${label}.json`, directory), JSON.stringify(rows, null, 2));
