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

## Reproduction and limits

The workspace diagnostic harness is `.design/engine-benchmark/run.mts`, outside this repository, run from the workspace root with:

```sh
node --import ./climbspot-backend/node_modules/tsx/dist/loader.mjs .design/engine-benchmark/run.mts final
```

It calls the real use cases and local routing adapter directly (bypassing the application planning cache), asserts length and Loop endpoint bounds, and caches routing responses in `responses.json` for comparable replays. `baseline.json` records the initial run, `multiscale.json` the intermediate exploration change, and `final.json` the final results including retracing. Replay timings must not be presented as end-to-end latency measurements: the captured response cache removes network and routing work.

Coverage is deliberately limited to these four points, one Activity, and the map already imported locally. This does not validate cycling, arbitrary start points, all distances, seasonal access or elevation accuracy. Substantial retracing remains at Chamonix; generating better candidates rather than only ranking the existing ones is a separate next improvement.
