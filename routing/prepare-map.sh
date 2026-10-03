#!/usr/bin/env bash
# Builds the map the local routing engine works on: the areas ClimbSpot is tried on,
# cut out of Geofabrik extracts and merged. Needs osmium (brew install osmium-tool).
set -euo pipefail
cd "$(dirname "$0")"

mkdir -p sources ors-docker/files
download() {
  [ -f "sources/$2.osm.pbf" ] || curl -sSL --fail -o "sources/$2.osm.pbf" "https://download.geofabrik.de/$1-latest.osm.pbf"
}
download europe/france/nord-pas-de-calais nord-pas-de-calais
download europe/belgium belgium
download europe/france/rhone-alpes rhone-alpes

# Lille, Tournai and the Flemish hills; Annecy and Chamonix (west,south,east,north).
osmium extract --overwrite --strategy smart -b 2.4,50.35,3.9,50.95 -o sources/lille-tournai-fr.osm.pbf sources/nord-pas-de-calais.osm.pbf
osmium extract --overwrite --strategy smart -b 2.4,50.35,3.9,50.95 -o sources/lille-tournai-be.osm.pbf sources/belgium.osm.pbf
osmium extract --overwrite --strategy smart -b 5.85,45.6,7.1,46.15 -o sources/annecy-chamonix.osm.pbf sources/rhone-alpes.osm.pbf
osmium merge --overwrite -o ors-docker/files/climbspot.osm.pbf \
  sources/lille-tournai-fr.osm.pbf sources/lille-tournai-be.osm.pbf sources/annecy-chamonix.osm.pbf
ls -lh ors-docker/files/climbspot.osm.pbf
