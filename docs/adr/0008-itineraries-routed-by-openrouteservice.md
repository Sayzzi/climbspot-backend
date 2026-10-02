# Itineraries are routed by OpenRouteService behind a port

Itineraries (Loops and Uphill Itineraries) are worked out over the road and trail network by a routing engine, behind a `RoutingProvider` port in the itineraries module. We start with the hosted OpenRouteService API: it covers the profiles our Activities need (foot-walking, foot-hiking, cycling-road, cycling-regular, cycling-mountain), returns elevations with the geometry, and was validated by the feasibility prototype (branch `prototype/itineraries-feasibility`).

## Consequences

- The free key allows about 200 directions a day, and planning one Itinerary request costs 6 to 10 calls. Each request therefore has a call budget, and identical requests are answered from a cache. This is enough to build and test, not to launch publicly.
- Before going public we must choose between hosting a routing engine (OpenRouteService or GraphHopper on an OpenStreetMap extract, roughly 8–16 GB of memory for France), a paid plan, or strict per-Visitor limits. Switching only needs a new `RoutingProvider` implementation.
- OpenRouteService's own round trips do not honour the asked length, so Loops are built by routing through waypoints instead.
