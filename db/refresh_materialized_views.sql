-- MVをまとめてrefreshする（運用の土台）
-- 使い方例:
--   CALL refresh_materialized_views();

DO $$
BEGIN
  -- no-op: file exists for reference
END $$;

CREATE OR REPLACE PROCEDURE refresh_materialized_views()
LANGUAGE plpgsql
AS $$
DECLARE
  v_name TEXT;
  v_is_populated BOOLEAN;
BEGIN
  -- 存在しない場合はスキップ（初期セットアップ段階で落ちないようにする）
  -- 注意: WITH NO DATA で作った直後は ispopulated=false のため、初回は CONCURRENTLY を使えません。
  FOREACH v_name IN ARRAY ARRAY[
    'mv_prefecture_job_stats_daily',
    'mv_prefecture_skill_stats_daily',
    'mv_municipality_job_category_stats_daily'
  ]
  LOOP
    IF to_regclass('public.' || v_name) IS NULL THEN
      CONTINUE;
    END IF;

    SELECT ispopulated
      INTO v_is_populated
    FROM pg_matviews
    WHERE schemaname = 'public'
      AND matviewname = v_name;

    BEGIN
      IF v_is_populated THEN
        EXECUTE format('REFRESH MATERIALIZED VIEW CONCURRENTLY %I', v_name);
      ELSE
        EXECUTE format('REFRESH MATERIALIZED VIEW %I', v_name);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- 例えば unique index 未作成などで CONCURRENTLY が失敗した場合は、非CONCURRENTLYで最後に試す
      BEGIN
        EXECUTE format('REFRESH MATERIALIZED VIEW %I', v_name);
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Failed to refresh materialized view %: %', v_name, SQLERRM;
      END;
    END;
  END LOOP;
END;
$$;
