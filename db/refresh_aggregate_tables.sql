-- 日次集計テーブルを指定期間で再計算（増分運用の土台）
-- 使い方例:
--   CALL refresh_aggregate_tables(CURRENT_DATE - 7, CURRENT_DATE);

BEGIN;

CREATE OR REPLACE PROCEDURE refresh_aggregate_tables(p_from DATE, p_to DATE)
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_from IS NULL OR p_to IS NULL THEN
    RAISE EXCEPTION 'p_from and p_to are required';
  END IF;
  IF p_from > p_to THEN
    RAISE EXCEPTION 'p_from must be <= p_to';
  END IF;

  -- 1) prefecture_job_stats_daily
  DELETE FROM prefecture_job_stats_daily
  WHERE target_date BETWEEN p_from AND p_to;

  INSERT INTO prefecture_job_stats_daily(target_date, prefecture_id, job_count, avg_salary_min, avg_salary_max)
  SELECT
    j.collected_at::date AS target_date,
    p.id AS prefecture_id,
    COUNT(j.id) AS job_count,
    AVG(j.salary_min)::numeric(10,2) AS avg_salary_min,
    AVG(j.salary_max)::numeric(10,2) AS avg_salary_max
  FROM job_postings j
  JOIN municipalities m ON m.id = j.municipality_id
  JOIN prefectures p ON p.id = m.prefecture_id
  WHERE j.is_active = TRUE
    AND j.collected_at::date BETWEEN p_from AND p_to
  GROUP BY j.collected_at::date, p.id;

  -- 2) prefecture_skill_stats_daily
  DELETE FROM prefecture_skill_stats_daily
  WHERE target_date BETWEEN p_from AND p_to;

  INSERT INTO prefecture_skill_stats_daily(target_date, prefecture_id, skill_id, job_count)
  SELECT
    j.collected_at::date AS target_date,
    p.id AS prefecture_id,
    s.id AS skill_id,
    COUNT(DISTINCT j.id) AS job_count
  FROM job_postings j
  JOIN municipalities m ON m.id = j.municipality_id
  JOIN prefectures p ON p.id = m.prefecture_id
  JOIN job_posting_skills jps ON jps.job_posting_id = j.id
  JOIN skills s ON s.id = jps.skill_id
  WHERE j.is_active = TRUE
    AND j.collected_at::date BETWEEN p_from AND p_to
  GROUP BY j.collected_at::date, p.id, s.id;

  -- 3) municipality_job_category_stats_daily
  DELETE FROM municipality_job_category_stats_daily
  WHERE target_date BETWEEN p_from AND p_to;

  INSERT INTO municipality_job_category_stats_daily(target_date, municipality_id, job_category_id, job_count)
  SELECT
    j.collected_at::date AS target_date,
    m.id AS municipality_id,
    jc.id AS job_category_id,
    COUNT(j.id) AS job_count
  FROM job_postings j
  JOIN municipalities m ON m.id = j.municipality_id
  LEFT JOIN job_categories jc ON jc.id = j.job_category_id
  WHERE j.is_active = TRUE
    AND j.collected_at::date BETWEEN p_from AND p_to
    AND jc.id IS NOT NULL
  GROUP BY j.collected_at::date, m.id, jc.id;
END;
$$;

COMMIT;
