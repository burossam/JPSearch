-- 日次集計テーブル（MVの代替/補完）
-- 目的: 増分更新（ETL）や履歴保持をやりやすくする

BEGIN;

CREATE TABLE IF NOT EXISTS prefecture_job_stats_daily (
  target_date DATE NOT NULL,
  prefecture_id INT NOT NULL REFERENCES prefectures(id),
  job_count INT NOT NULL,
  avg_salary_min NUMERIC(10,2),
  avg_salary_max NUMERIC(10,2),
  PRIMARY KEY (target_date, prefecture_id)
);

CREATE TABLE IF NOT EXISTS prefecture_skill_stats_daily (
  target_date DATE NOT NULL,
  prefecture_id INT NOT NULL REFERENCES prefectures(id),
  skill_id BIGINT NOT NULL REFERENCES skills(id),
  job_count INT NOT NULL,
  PRIMARY KEY (target_date, prefecture_id, skill_id)
);

CREATE TABLE IF NOT EXISTS municipality_job_category_stats_daily (
  target_date DATE NOT NULL,
  municipality_id INT NOT NULL REFERENCES municipalities(id),
  job_category_id INT NOT NULL REFERENCES job_categories(id),
  job_count INT NOT NULL,
  PRIMARY KEY (target_date, municipality_id, job_category_id)
);

CREATE INDEX IF NOT EXISTS idx_prefecture_job_stats_daily_date ON prefecture_job_stats_daily(target_date);
CREATE INDEX IF NOT EXISTS idx_prefecture_skill_stats_daily_date ON prefecture_skill_stats_daily(target_date);
CREATE INDEX IF NOT EXISTS idx_municipality_job_category_stats_daily_date ON municipality_job_category_stats_daily(target_date);

COMMIT;
