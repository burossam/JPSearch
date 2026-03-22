-- 集計/GeoJSON出力の例

-- 1) 都道府県別 求人数（現時点）
SELECT
  p.code,
  p.name,
  COUNT(j.id) AS job_count
FROM prefectures p
LEFT JOIN municipalities m ON m.prefecture_id = p.id
LEFT JOIN job_postings j ON j.municipality_id = m.id AND j.is_active = TRUE
GROUP BY p.id, p.code, p.name
ORDER BY job_count DESC;

-- 2) 都道府県×スキル（例: TypeScript）
-- ※ skills.name は表記ゆれ対策の正規化が重要
SELECT
  p.code,
  p.name,
  COUNT(DISTINCT j.id) AS job_count
FROM job_postings j
JOIN municipalities m ON m.id = j.municipality_id
JOIN prefectures p ON p.id = m.prefecture_id
JOIN job_posting_skills jps ON jps.job_posting_id = j.id
JOIN skills s ON s.id = jps.skill_id
WHERE j.is_active = TRUE
  AND s.name = 'TypeScript'
GROUP BY p.id, p.code, p.name
ORDER BY job_count DESC;

-- 3) 色分け地図向け（PostGISあり）: 都道府県ポリゴン + job_count
-- geomが無い/空の場合は NULL になります
SELECT
  p.code,
  p.name,
  COUNT(j.id) AS job_count,
  ST_AsGeoJSON(p.geom)::json AS geom
FROM prefectures p
LEFT JOIN municipalities m ON m.prefecture_id = p.id
LEFT JOIN job_postings j ON j.municipality_id = m.id AND j.is_active = TRUE
GROUP BY p.id, p.code, p.name, p.geom;

-- 4) GeoJSON FeatureCollection（PostGISあり）
-- APIが無くてもSQLだけで "塗り分け用JSON" を作れる
WITH stats AS (
  SELECT
    p.code,
    p.name,
    COUNT(j.id) AS job_count,
    ST_AsGeoJSON(p.geom)::json AS geom
  FROM prefectures p
  LEFT JOIN municipalities m ON m.prefecture_id = p.id
  LEFT JOIN job_postings j ON j.municipality_id = m.id AND j.is_active = TRUE
  GROUP BY p.id, p.code, p.name, p.geom
)
SELECT json_build_object(
  'type', 'FeatureCollection',
  'features', json_agg(
    json_build_object(
      'type', 'Feature',
      'geometry', stats.geom,
      'properties', json_build_object(
        'prefectureCode', stats.code,
        'prefectureName', stats.name,
        'jobCount', stats.job_count
      )
    )
  )
)
FROM stats;
