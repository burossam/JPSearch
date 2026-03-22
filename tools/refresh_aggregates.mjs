import process from 'node:process';
import pg from 'pg';

const { Client } = pg;

function getEnv(name, fallback) {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : fallback;
}

function parseDateArg(s) {
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

async function main() {
  const databaseUrl = getEnv('DATABASE_URL', 'postgresql://jps:jps@localhost:5432/jps');

  // Usage:
  //   node tools/refresh_aggregates.mjs 2026-03-01 2026-03-12
  const fromArg = process.argv[2];
  const toArg = process.argv[3];

  const today = new Date();
  const to = parseDateArg(toArg) ?? today.toISOString().slice(0, 10);

  const fromDefault = new Date(today);
  fromDefault.setDate(fromDefault.getDate() - 7);
  const from = parseDateArg(fromArg) ?? fromDefault.toISOString().slice(0, 10);

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    // 1) aggregate tables (optional)
    try {
      await client.query('CALL refresh_aggregate_tables($1::date, $2::date);', [from, to]);
    } catch (e) {
      if (e && e.code === '42883') {
        // eslint-disable-next-line no-console
        console.warn('[WARN] refresh_aggregate_tables is not installed. Skipped.');
      } else {
        throw e;
      }
    }

    // 2) materialized views (optional)
    try {
      await client.query('CALL refresh_materialized_views();');
    } catch (e) {
      if (e && e.code === '42883') {
        // eslint-disable-next-line no-console
        console.warn('[WARN] refresh_materialized_views is not installed. Skipped.');
      } else {
        throw e;
      }
    }

    // eslint-disable-next-line no-console
    console.log(`OK: refreshed aggregates (from=${from}, to=${to})`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});
