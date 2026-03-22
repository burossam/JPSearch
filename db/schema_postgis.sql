-- PostgreSQL + PostGIS schema（地図可視化向け）
-- 目的: 集計値 + 地域ポリゴンをJOINして、都道府県/市区町村の色分け地図を作る

BEGIN;

-- PostGIS（dockerイメージがpostgisなら有効化できる）
CREATE EXTENSION IF NOT EXISTS postgis;

-- 1) マスタ: 都道府県
CREATE TABLE IF NOT EXISTS prefectures (
  id SERIAL PRIMARY KEY,
  code VARCHAR(2) UNIQUE NOT NULL,
  name VARCHAR(50) NOT NULL,
  geom GEOMETRY(MultiPolygon, 4326)
);

-- 2) マスタ: 市区町村
CREATE TABLE IF NOT EXISTS municipalities (
  id SERIAL PRIMARY KEY,
  code VARCHAR(10) UNIQUE NOT NULL,
  prefecture_id INT NOT NULL REFERENCES prefectures(id),
  name VARCHAR(100) NOT NULL,
  municipality_type VARCHAR(20),
  geom GEOMETRY(MultiPolygon, 4326)
);

-- 3) マスタ: 職種
CREATE TABLE IF NOT EXISTS job_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  parent_name VARCHAR(100)
);

-- 4) マスタ: 雇用形態
CREATE TABLE IF NOT EXISTS employment_types (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL
);

-- 5) マスタ: 会社
CREATE TABLE IF NOT EXISTS companies (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  industry VARCHAR(100)
);

-- 6) マスタ: スキル
CREATE TABLE IF NOT EXISTS skills (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  skill_group VARCHAR(100)
);

-- 7) 事実: 求人本体
CREATE TABLE IF NOT EXISTS job_postings (
  id BIGSERIAL PRIMARY KEY,
  source_name VARCHAR(100) NOT NULL,
  source_job_id VARCHAR(255) NOT NULL,
  title VARCHAR(255) NOT NULL,
  company_id BIGINT REFERENCES companies(id),
  municipality_id INT REFERENCES municipalities(id),
  job_category_id INT REFERENCES job_categories(id),
  employment_type_id INT REFERENCES employment_types(id),
  salary_min INT,
  salary_max INT,
  description TEXT,
  posted_at DATE,
  collected_at DATE NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  UNIQUE (source_name, source_job_id)
);

-- 8) 中間: 求人×スキル
CREATE TABLE IF NOT EXISTS job_posting_skills (
  job_posting_id BIGINT NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
  skill_id BIGINT NOT NULL REFERENCES skills(id),
  PRIMARY KEY (job_posting_id, skill_id)
);

-- 9) 駅（任意）
CREATE TABLE IF NOT EXISTS stations (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  line_name VARCHAR(100),
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION
);

CREATE TABLE IF NOT EXISTS job_posting_stations (
  job_posting_id BIGINT NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
  station_id BIGINT NOT NULL REFERENCES stations(id),
  PRIMARY KEY (job_posting_id, station_id)
);

-- 10) 生データ（任意だが推奨）
CREATE TABLE IF NOT EXISTS raw_job_postings (
  id BIGSERIAL PRIMARY KEY,
  source_name VARCHAR(100) NOT NULL,
  source_job_id VARCHAR(255),
  raw_json JSONB NOT NULL,
  collected_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ETL運用: 処理状態（増分実行のため）
ALTER TABLE IF EXISTS raw_job_postings
  ADD COLUMN IF NOT EXISTS processed_at TIMESTAMP;

ALTER TABLE IF EXISTS raw_job_postings
  ADD COLUMN IF NOT EXISTS processing_error TEXT;

ALTER TABLE IF EXISTS raw_job_postings
  ADD COLUMN IF NOT EXISTS normalized_job_posting_id BIGINT;

-- INDEX（最低限）
CREATE INDEX IF NOT EXISTS idx_job_postings_municipality_id ON job_postings(municipality_id);
CREATE INDEX IF NOT EXISTS idx_job_postings_job_category_id ON job_postings(job_category_id);
CREATE INDEX IF NOT EXISTS idx_job_postings_employment_type_id ON job_postings(employment_type_id);
CREATE INDEX IF NOT EXISTS idx_job_postings_is_active ON job_postings(is_active);
CREATE INDEX IF NOT EXISTS idx_job_postings_collected_at ON job_postings(collected_at);
CREATE INDEX IF NOT EXISTS idx_raw_job_postings_collected_at ON raw_job_postings(collected_at);
CREATE INDEX IF NOT EXISTS idx_raw_job_postings_processed_at ON raw_job_postings(processed_at);

-- 地理系: 空間INDEX（geometryが入ったら効く）
CREATE INDEX IF NOT EXISTS idx_prefectures_geom ON prefectures USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_municipalities_geom ON municipalities USING GIST (geom);

COMMIT;
