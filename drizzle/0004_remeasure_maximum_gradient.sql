-- The maximum Gradient is now measured over the steepest 500 m instead of 100 m
-- (MAXIMUM_GRADIENT_STRETCH, ADR 0005): re-measure the stored Ascents from their samples.
-- For each sample, the stretch runs to the first sample at least 500 m further; an Ascent
-- shorter than that keeps its average Gradient, as `measure` does.
WITH samples AS (
  SELECT a.id, s.idx, s.distance, a.elevations[s.idx] AS elevation
  FROM "ascents" a, unnest(a."sample_distances") WITH ORDINALITY AS s(distance, idx)
), stretches AS (
  SELECT f.id, MAX((t.elevation - f.elevation) / (t.distance - f.distance)) AS steepest
  FROM samples f
  CROSS JOIN LATERAL (
    SELECT t.elevation, t.distance
    FROM samples t
    WHERE t.id = f.id AND t.distance - f.distance >= 500
    ORDER BY t.idx
    LIMIT 1
  ) t
  GROUP BY f.id
)
UPDATE "ascents" a
SET "maximum_gradient" = GREATEST(a."average_gradient", COALESCE(s.steepest, a."average_gradient"))
FROM "ascents" a2
LEFT JOIN stretches s ON s.id = a2.id
WHERE a.id = a2.id;
