-- Ascents now keep the shape shown on maps (`path`) apart from the 100 m samples that
-- are measured (`sampled_path`, with each sample's distance along the path).
ALTER TABLE "ascents" ADD COLUMN "sampled_path" geography(LineString, 4326);--> statement-breakpoint
ALTER TABLE "ascents" ADD COLUMN "sample_distances" double precision[];--> statement-breakpoint
-- Existing Ascents only have their samples: reuse them as both, with distances between samples.
WITH points AS (
  SELECT a.id, (dp).path[1] AS idx, ((dp).geom)::geography AS point
  FROM "ascents" a, LATERAL ST_DumpPoints(a."path"::geometry) AS dp
), steps AS (
  SELECT id, idx,
    COALESCE(ST_Distance(point, LAG(point) OVER (PARTITION BY id ORDER BY idx), false), 0) AS step
  FROM points
), cumulated AS (
  SELECT id, array_agg(total ORDER BY idx) AS distances
  FROM (SELECT id, idx, SUM(step) OVER (PARTITION BY id ORDER BY idx) AS total FROM steps) AS running
  GROUP BY id
)
UPDATE "ascents" a
SET "sampled_path" = a."path", "sample_distances" = c.distances
FROM cumulated c
WHERE a.id = c.id;--> statement-breakpoint
ALTER TABLE "ascents" ALTER COLUMN "sampled_path" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "ascents" ALTER COLUMN "sample_distances" SET NOT NULL;
