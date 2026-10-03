-- Ascents now keep their Height Gained and Flat-Equivalent Distance (see CONTEXT.md).
ALTER TABLE "ascents" ADD COLUMN "height_gained" double precision;--> statement-breakpoint
ALTER TABLE "ascents" ADD COLUMN "flat_equivalent_distance" double precision;--> statement-breakpoint
-- Existing Ascents are measured from their samples, as `measure` does: every rise counts in
-- the Height Gained; the Flat-Equivalent Distance sums, over stretches with a length, each
-- length times Minetti's cost of running at its Gradient (clamped to ±45 %) over the flat
-- cost, never below 0.9; a profile without such stretches has none.
WITH samples AS (
  SELECT a.id, s.idx, s.distance, a.elevations[s.idx] AS elevation
  FROM "ascents" a, unnest(a."sample_distances") WITH ORDINALITY AS s(distance, idx)
), stretches AS (
  SELECT id,
    distance - LAG(distance) OVER (PARTITION BY id ORDER BY idx) AS length,
    elevation - LAG(elevation) OVER (PARTITION BY id ORDER BY idx) AS rise
  FROM samples
), measured AS (
  SELECT id,
    SUM(GREATEST(0, rise)) AS height_gained,
    SUM(length * GREATEST(0.9,
      (155.4 * i ^ 5 - 30.4 * i ^ 4 - 43.3 * i ^ 3 + 46.3 * i ^ 2 + 19.5 * i + 3.6) / 3.6
    )) FILTER (WHERE length > 0) AS flat_equivalent_distance
  FROM (
    SELECT id, length, rise,
      CASE WHEN length > 0 THEN GREATEST(-0.45, LEAST(0.45, rise / length)) END AS i
    FROM stretches
    WHERE rise IS NOT NULL
  ) AS costed
  GROUP BY id
)
UPDATE "ascents" a
SET "height_gained" = COALESCE(m.height_gained, 0),
  "flat_equivalent_distance" = COALESCE(m.flat_equivalent_distance, 0)
FROM "ascents" a2
LEFT JOIN measured m ON m.id = a2.id
WHERE a.id = a2.id;--> statement-breakpoint
ALTER TABLE "ascents" ALTER COLUMN "height_gained" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "ascents" ALTER COLUMN "flat_equivalent_distance" SET NOT NULL;
