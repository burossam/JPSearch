-- 集計のmaterialized view例
-- 注意: MVは refresh が必要。初期は "WITH NO DATA" で作っておくと安全。

BEGIN;

-- 都道府県別・日別 求人件数 + 平均給与（例）
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_prefecture_job_stats_daily AS
SELECT
  j.collected_at::date AS target_date,
  p.id AS prefecture_id,
  p.code AS prefecture_code,
  p.name AS prefecture_name,
  COUNT(j.id) AS job_count,
  AVG(j.salary_min)::numeric(10,2) AS avg_salary_min,
  AVG(j.salary_max)::numeric(10,2) AS avg_salary_max
FROM prefectures p
LEFT JOIN municipalities m ON m.prefecture_id = p.id
LEFT JOIN job_postings j ON j.municipality_id = m.id AND j.is_active = TRUE
GROUP BY j.collected_at::date, p.id, p.code, p.name
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS mv_prefecture_job_stats_daily_pk
  ON mv_prefecture_job_stats_daily(target_date, prefecture_id);

-- 都道府県×スキル（日別）
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_prefecture_skill_stats_daily AS
SELECT
  j.collected_at::date AS target_date,
  p.id AS prefecture_id,
  s.id AS skill_id,
  s.name AS skill_name,
  COUNT(DISTINCT j.id) AS job_count
FROM job_postings j
JOIN municipalities m ON m.id = j.municipality_id
JOIN prefectures p ON p.id = m.prefecture_id
JOIN job_posting_skills jps ON jps.job_posting_id = j.id
JOIN skills s ON s.id = jps.skill_id
WHERE j.is_active = TRUE
GROUP BY j.collected_at::date, p.id, s.id, s.name
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS mv_prefecture_skill_stats_daily_pk
  ON mv_prefecture_skill_stats_daily(target_date, prefecture_id, skill_id);

-- 市区町村×職種（日別）
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_municipality_job_category_stats_daily AS
SELECT
  j.collected_at::date AS target_date,
  m.id AS municipality_id,
  m.code AS municipality_code,
  m.name AS municipality_name,
  jc.id AS job_category_id,
  jc.name AS job_category_name,
  COUNT(j.id) AS job_count
FROM job_postings j
JOIN municipalities m ON m.id = j.municipality_id
LEFT JOIN job_categories jc ON jc.id = j.job_category_id
WHERE j.is_active = TRUE
GROUP BY j.collected_at::date, m.id, m.code, m.name, jc.id, jc.name
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS mv_municipality_job_category_stats_daily_pk
  ON mv_municipality_job_category_stats_daily(target_date, municipality_id, job_category_id);

COMMIT;

-- refresh例:
-- REFRESH MATERIALIZED VIEW CONCURRENTLY mv_prefecture_job_stats_daily;
-- REFRESH MATERIALIZED VIEW CONCURRENTLY mv_prefecture_skill_stats_daily;
-- REFRESH MATERIALIZED VIEW CONCURRENTLY mv_municipality_job_category_stats_daily;
