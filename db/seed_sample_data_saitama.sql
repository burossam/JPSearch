-- デモ用の最小データ（埼玉県のみ）
-- 目的: 都道府県別集計の "0件以外" を作って、統計→GeoJSON→色分けの流れを確認する
-- 注意: 実データではありません

BEGIN;

-- companies
INSERT INTO companies(name, industry)
VALUES
  ('デモ株式会社A','IT'),
  ('デモ株式会社B','製造')
ON CONFLICT DO NOTHING;

-- employment_types
INSERT INTO employment_types(name)
VALUES ('正社員'), ('契約社員')
ON CONFLICT (name) DO NOTHING;

-- job_categories
INSERT INTO job_categories(name, parent_name)
VALUES
  ('フロントエンド','開発'),
  ('バックエンド','開発')
ON CONFLICT DO NOTHING;

-- skills
INSERT INTO skills(name, skill_group)
VALUES
  ('TypeScript','language'),
  ('React','framework'),
  ('PostgreSQL','database')
ON CONFLICT (name) DO NOTHING;

-- job_postings (埼玉県: さいたま市大宮区/川口市/川越市)
WITH
  p AS (SELECT id FROM prefectures WHERE code='11'),
  m_omiya AS (SELECT id FROM municipalities WHERE code='11103'),
  m_kawaguchi AS (SELECT id FROM municipalities WHERE code='11203'),
  m_kawagoe AS (SELECT id FROM municipalities WHERE code='11201'),
  c_a AS (SELECT id FROM companies WHERE name='デモ株式会社A' LIMIT 1),
  c_b AS (SELECT id FROM companies WHERE name='デモ株式会社B' LIMIT 1),
  jc_fe AS (SELECT id FROM job_categories WHERE name='フロントエンド' LIMIT 1),
  jc_be AS (SELECT id FROM job_categories WHERE name='バックエンド' LIMIT 1),
  et_ft AS (SELECT id FROM employment_types WHERE name='正社員' LIMIT 1),
  et_ct AS (SELECT id FROM employment_types WHERE name='契約社員' LIMIT 1)
INSERT INTO job_postings(
  source_name,
  source_job_id,
  title,
  company_id,
  municipality_id,
  job_category_id,
  employment_type_id,
  salary_min,
  salary_max,
  description,
  posted_at,
  collected_at,
  is_active
)
VALUES
  ('demo','saitama-001','フロントエンドエンジニア（TypeScript/React）',(SELECT id FROM c_a),(SELECT id FROM m_omiya),(SELECT id FROM jc_fe),(SELECT id FROM et_ft),4500000,7000000,'デモ求人です','2026-03-01','2026-03-12',TRUE),
  ('demo','saitama-002','バックエンドエンジニア（PostgreSQL）',(SELECT id FROM c_a),(SELECT id FROM m_kawaguchi),(SELECT id FROM jc_be),(SELECT id FROM et_ft),5000000,8000000,'デモ求人です','2026-03-02','2026-03-12',TRUE),
  ('demo','saitama-003','フロント/バックエンド（React + PostgreSQL）',(SELECT id FROM c_b),(SELECT id FROM m_kawagoe),(SELECT id FROM jc_be),(SELECT id FROM et_ct),4200000,6500000,'デモ求人です','2026-03-03','2026-03-12',TRUE)
ON CONFLICT (source_name, source_job_id) DO UPDATE
SET
  title = EXCLUDED.title,
  company_id = EXCLUDED.company_id,
  municipality_id = EXCLUDED.municipality_id,
  job_category_id = EXCLUDED.job_category_id,
  employment_type_id = EXCLUDED.employment_type_id,
  salary_min = EXCLUDED.salary_min,
  salary_max = EXCLUDED.salary_max,
  description = EXCLUDED.description,
  posted_at = EXCLUDED.posted_at,
  collected_at = EXCLUDED.collected_at,
  is_active = EXCLUDED.is_active;

-- job_posting_skills
WITH
  jp1 AS (SELECT id FROM job_postings WHERE source_name='demo' AND source_job_id='saitama-001'),
  jp2 AS (SELECT id FROM job_postings WHERE source_name='demo' AND source_job_id='saitama-002'),
  jp3 AS (SELECT id FROM job_postings WHERE source_name='demo' AND source_job_id='saitama-003'),
  s_ts AS (SELECT id FROM skills WHERE name='TypeScript'),
  s_react AS (SELECT id FROM skills WHERE name='React'),
  s_pg AS (SELECT id FROM skills WHERE name='PostgreSQL')
INSERT INTO job_posting_skills(job_posting_id, skill_id)
SELECT jp1.id, s_ts.id FROM jp1, s_ts
UNION ALL
SELECT jp1.id, s_react.id FROM jp1, s_react
UNION ALL
SELECT jp2.id, s_pg.id FROM jp2, s_pg
UNION ALL
SELECT jp3.id, s_react.id FROM jp3, s_react
UNION ALL
SELECT jp3.id, s_pg.id FROM jp3, s_pg
ON CONFLICT DO NOTHING;

COMMIT;
