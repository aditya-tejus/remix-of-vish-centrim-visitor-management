WITH res AS (
  SELECT id, lower(trim(first_name || ' ' || surname)) AS full_name
  FROM public.visitors WHERE type = 'resident'
), uniq AS (
  SELECT full_name, (array_agg(id))[1] AS rid FROM res GROUP BY full_name HAVING count(DISTINCT id) = 1
)
UPDATE public.visitors v
SET visited_resident_ids = ARRAY[u.rid]
FROM uniq u
WHERE v.type <> 'resident'
  AND (v.visited_resident_ids IS NULL OR array_length(v.visited_resident_ids, 1) IS NULL)
  AND lower(trim(v.whom_to_visit)) = u.full_name;