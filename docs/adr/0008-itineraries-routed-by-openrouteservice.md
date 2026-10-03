# Itineraries are routed by OpenRouteService behind a port

Itineraries (Loops and Uphill Itineraries) are worked out over the road and trail network by a routing engine, behind a `RoutingProvider` port in the itineraries module. We start with the hosted OpenRouteService API: it covers the profiles our Activities need (foot-walking, foot-hiking, cycling-road, cycling-regular, cycling-mountain), returns elevations with the geometry, and was validated by the feasibility prototype (branch `prototype/itineraries-feasibility`).

## Consequences

- The free key allows about 200 directions a day. Each request has a call budget, and identical requests are answered from a cache. Since the update below, the budget is sized for a self-hosted engine (up to 40 calls when Loops must look further for the asked Relief), so the hosted key now only suits a few requests a day.
- Before going public we must choose between hosting a routing engine (OpenRouteService or GraphHopper on an OpenStreetMap extract, roughly 8–16 GB of memory for France), a paid plan, or strict per-Visitor limits. Switching only needs a new `RoutingProvider` implementation.
- OpenRouteService's own round trips do not honour the asked length, so Loops are built by routing through waypoints instead.

## Update: self-hosted for development

About 200 directions a day turned out to be two or three planning requests per hour of work, too few to calibrate the search. We now run OpenRouteService ourselves for development (`routing/`), on OpenStreetMap extracts of the areas the app is tried on, with the same profiles and elevations: no key, no quota, and the adapter is unchanged apart from its base URL (`ORS_URL`). The hosted API stays possible with a key. For production, self-hosting the same container is now the preferred option; it still has to be sized and paid for (about 16 GB of memory for France).
