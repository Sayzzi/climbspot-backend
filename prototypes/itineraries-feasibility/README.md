# PROTOTYPE — itineraries feasibility (throwaway)

Question: can OpenRouteService (round trips with elevation) find **Uphill Itineraries**
(target average Gradient range, length never shorter and at most +20 %) and **Loops**
(target distance, never shorter and at most +20 %, with a Relief) near a point,
within a sensible number of requests?

Run (spends ORS quota, cached in `.cache/`, wipe it to start over):

    pnpm exec tsx --env-file=.env prototypes/itineraries-feasibility/experiment.ts

It prints a table and writes `report.html` (open it in a browser).
This code is not production code: no tests, no error handling, no reuse.

## Verdict (2026-10-02, 44 ORS requests)

- **Uphill Itineraries: feasible.** Six round trips (2.5 × the asked length) around the
  point, then the best uphill stretch in each (100 m sampling, 3-sample smoothing, catalogue
  Dip rule). Annecy 2–5 % over 3 km: 2 exact matches (3.5 km @ 3.7 %, 3.1 km @ 5.0 %).
  Bédoin 6–9 % over 5 km: exact match (5.0 km @ 7.5 %). Flat Chartres 2–5 %: no exact match
  (best 1.7 %), as the terrain has none; show close matches instead.
- **Loops via ORS `round_trip`: not usable.** Asked lengths are not honoured (5 km asked →
  14.3, 2.4, 11.2 km) and correcting the asked length does not converge across seeds.
- **Loops via waypoints on a circle (`loops-by-waypoints.ts`): feasible.** Three waypoints
  around a centre offset from the start, radius rescaled until the length is within
  100–120 %, three bearings to vary the Relief. Annecy 5 km rolling: found in 7 requests.
  Chartres 10 km flat: 2 requests. Bédoin 30 km hilly: not found in 8 (28.3 km hilly,
  30.5 km rolling): sparse mountain roads make lengths jump; needs more bearings.
- **Quota is the real constraint.** The key's daily quota looks like ~200 directions
  (`x-ratelimit-remaining`), and one search costs ~6 (Uphill) to ~10 (Loop) requests:
  about 20–30 searches a day for everyone. Production needs a self-hosted routing engine
  (ORS or GraphHopper on an OpenStreetMap extract), a paid plan, or strict caching.
