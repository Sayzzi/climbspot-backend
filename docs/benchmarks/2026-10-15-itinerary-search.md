# Itinerary search calibration, 15 October 2026

Measured against the existing local OpenRouteService v10.0.1 graph, with Running as the Activity. Each city has three scenarios: 10 km flat Loop, 10 km hilly Loop, and 1 km Uphill Itinerary at 3–6 % within 10 km. These are search results, not evidence that no other matching way exists.

| City     | Latitude, longitude | Exact flat Loops | Exact hilly Loops | Exact Uphill Itineraries |
| -------- | ------------------- | ---------------- | ----------------- | ------------------------ |
| Tournai  | 50.606, 3.388       | 3                | 0                 | 1                        |
| Lille    | 50.6366, 3.0635     | 3                | 0                 | 0                        |
| Annecy   | 45.899, 6.129       | 2                | 2                 | 3                        |
| Chamonix | 45.9237, 6.8694     | 0                | 3                 | 3                        |

The exact counts did not change after this calibration. All twelve scenarios still return three proposals; mismatching proposals explicitly remain close matches. All measured proposals pass the 100–120 % length rule and Loop ends remain within 300 m of the requested point.

## Changes and measured effects

- Uphill exploration retains its outer directions (80 % of the radius), then tries the same directions at 40 %. This recovers nearby ways when the outer destinations have no routable way (HTTP regression test). On the real scenarios it improves the third Tournai alternative from 2.04 % to 2.50 %, and the second Lille alternative from 1.16 % to 1.30 %, without finding additional exact matches. Tournai and Lille now use 18 provider calls instead of 10; Annecy and Chamonix stop early as before (3 and 7). Hill Sessions share the exploration, keeping their existing budget for Warm-ups.
- A Loop and its reverse are treated as duplicates using the existing third/two-thirds landmarks. A regression test previously returned two proposals for the same circuit in opposite directions, and now returns one.
- Among proposals equally close to the requested Relief, prefer the least retracing. The first exact hilly Loop at Annecy now retraces 0.1 % instead of 14.8 %, and at Chamonix 26.8 % instead of 31.7 %. At Tournai the first flat Loop improves from 9.5 % to 8.9 %. No additional routing calls are needed for this ranking.

Retracing counts an undirected geometry edge every time after its first traversal, weighted by its length. Coordinates rounded to six decimals absorb arithmetic noise (about 0.1 m). It undercounts differently segmented versions of the same way and is not a measure of road safety or surface quality. The reversed-Loop check remains a landmark heuristic, not a full geometric overlap test.

## Checked afterwards (16 October 2026)

Replaying the recorded responses gives the same proposals as above. Three further checks:

- **Retracing measure.** Against a spatial measure (the share of the path, sampled every 20 m, passing within 12 m of where it already went at least 150 m earlier), the edge measure differs by at most 2 points on every proposal, and orders the proposals the same way except two Lille flat Loops less than a point apart. It is kept: the routing engine retraces a way over the same vertices, so the undercount the edge measure allows for does not show on real answers, and it costs no sampling.
- **Nearer spokes.** Skipping a nearer spoke whose destination a farther way already passed within 300 m saves 3 of the 18 calls at Tournai and Lille with identical proposals, but loses a Lille alternative from 600 m. Not worth a further rule while routing is self-hosted.
- **Duplicates.** The same circuit found twice now keeps its better form (exact first, then closest Relief, then least retracing) instead of the first one found. No recorded scenario has such a pair, so the results above are unchanged; a regression test covers it.

## Reproduction and limits

The benchmark lives in the repository: `routing/benchmark.ts`, run with

```sh
pnpm bench:itineraries <label>
```

It calls the real use cases and the routing adapter directly (bypassing the application planning cache), asserts the length rule and Loop end bounds, and records routing responses in `routing/.benchmark/responses.json` (not versioned), so that later runs replay the same answers without the routing engine. Results go to `routing/.benchmark/<label>.json`. Replayed timings must not be presented as end-to-end latency measurements: the recorded responses remove network and routing work.

Coverage is deliberately limited to these four points, one Activity, and the map already imported locally. This does not validate cycling, arbitrary start points, all distances, seasonal access or elevation accuracy. Substantial retracing remains at Chamonix; generating better candidates rather than only ranking the existing ones is a separate next improvement.
