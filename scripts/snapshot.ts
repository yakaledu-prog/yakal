/**
 * Save and restore the local database around a reset.
 *
 *   npm run db:snapshot          write every row to .snapshots/latest
 *   npm run db:snapshot -- --as before-enrolments
 *   npm run db:restore           put the newest snapshot back
 *   npm run db:restore -- --from before-enrolments
 *   npm run db:snapshot -- --list
 *
 * The problem this solves: applying a changed migration means `supabase db
 * reset`, which drops everything, so an afternoon of hand-made test data goes
 * with it.
 *
 * The interesting part is putting data back into a schema that has moved.
 * Rather than mapping types by hand, the restore leans on
 * jsonb_populate_recordset(NULL::public.thing, ...), which casts JSON straight
 * to the table's row type. Keys the table no longer has are ignored, and the
 * insert names only the columns present in both the snapshot and the live
 * table, so a column added since takes its DEFAULT instead of a NULL that
 * would fail a NOT NULL.
 *
 * What it will not do is guess. A renamed column reads as one dropped and one
 * added, and there is no safe way to tell that apart from an actual rename, so
 * it reports both and moves on rather than quietly inventing a mapping. Read
 * the summary: it says exactly what it dropped and what it defaulted.
 *
 * Local only. It writes with triggers and foreign keys disabled, which is fine
 * for a development database and unthinkable anywhere else, so it refuses to
 * run against anything but the local stack.
 */
import { execFileSync } from "child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SNAPSHOT_DIR = join(ROOT, ".snapshots");

const DB = {
  host: process.env.SNAPSHOT_DB_HOST ?? "127.0.0.1",
  port: process.env.SNAPSHOT_DB_PORT ?? "54322",
  user: process.env.SNAPSHOT_DB_USER ?? "postgres",
  password: process.env.SNAPSHOT_DB_PASSWORD ?? "postgres",
  name: process.env.SNAPSHOT_DB_NAME ?? "postgres",
};

// Losing the auth rows means losing every login, so they travel with the data.
// identities is what lets a password account sign in at all.
const AUTH_TABLES = ["users", "identities"];

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

function psql(sql: string): string {
  return execFileSync(
    "psql",
    ["-h", DB.host, "-p", DB.port, "-U", DB.user, "-d", DB.name, "-tAq", "-v", "ON_ERROR_STOP=1", "-c", sql],
    { env: { ...process.env, PGPASSWORD: DB.password }, encoding: "utf8", maxBuffer: 512 * 1024 * 1024 }
  ).trim();
}

function psqlFile(sql: string): string {
  const tmp = join(SNAPSHOT_DIR, ".run.sql");
  writeFileSync(tmp, sql);
  try {
    return execFileSync(
      "psql",
      ["-h", DB.host, "-p", DB.port, "-U", DB.user, "-d", DB.name, "-tAq", "-v", "ON_ERROR_STOP=1", "-f", tmp],
      { env: { ...process.env, PGPASSWORD: DB.password }, encoding: "utf8", maxBuffer: 512 * 1024 * 1024 }
    ).trim();
  } finally {
    rmSync(tmp, { force: true });
  }
}

/** Refuse anything that is not the local Docker stack. */
function assertLocal() {
  const local = DB.host === "127.0.0.1" || DB.host === "localhost";
  if (!local) {
    console.error(`\n  Refusing to run against ${DB.host}. This is a local development tool.\n`);
    process.exit(1);
  }
}

function tablesIn(schema: string): string[] {
  return psql(
    `select table_name from information_schema.tables
      where table_schema = '${schema}' and table_type = 'BASE TABLE'
      order by table_name;`
  )
    .split("\n")
    .filter(Boolean);
}

function columnsOf(schema: string, table: string): string[] {
  return psql(
    `select column_name from information_schema.columns
      where table_schema = '${schema}' and table_name = '${table}'
        and is_generated = 'NEVER' and identity_generation is null
      order by ordinal_position;`
  )
    .split("\n")
    .filter(Boolean);
}

// ---------- save ----------

function save() {
  assertLocal();
  const name = flag("as") ?? "latest";
  const dir = join(SNAPSHOT_DIR, name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });

  const targets: { schema: string; table: string }[] = [
    ...AUTH_TABLES.map((t) => ({ schema: "auth", table: t })),
    ...tablesIn("public").map((t) => ({ schema: "public", table: t })),
  ];

  let total = 0;
  const manifest: Record<string, number> = {};

  for (const { schema, table } of targets) {
    // json_agg over the whole table: fine at development volumes, and it keeps
    // the file readable so a snapshot can be inspected or hand-edited.
    const json = psql(
      `select coalesce(json_agg(t)::text, '[]') from ${schema}.${quote(table)} t;`
    );
    const rows = JSON.parse(json || "[]");
    if (rows.length === 0) continue;

    writeFileSync(join(dir, `${schema}.${table}.json`), JSON.stringify(rows, null, 2));
    manifest[`${schema}.${table}`] = rows.length;
    total += rows.length;
  }

  writeFileSync(
    join(dir, "manifest.json"),
    JSON.stringify({ takenAt: new Date().toISOString(), tables: manifest }, null, 2)
  );

  console.log(`\nSaved ${total} rows across ${Object.keys(manifest).length} tables`);
  console.log(`  ${dir}\n`);
  for (const [t, n] of Object.entries(manifest)) console.log(`    ${String(n).padStart(6)}  ${t}`);
  console.log(`\nRestore with: npm run db:restore${name === "latest" ? "" : ` -- --from ${name}`}\n`);
}

const RESERVED = new Set(["user", "order", "group", "table", "session", "default"]);
const quote = (ident: string) => (RESERVED.has(ident) ? `"${ident}"` : ident);

// ---------- restore ----------

function restore() {
  assertLocal();
  const name = flag("from") ?? "latest";
  const dir = join(SNAPSHOT_DIR, name);
  if (!existsSync(dir)) {
    console.error(`\n  No snapshot called "${name}". Run npm run db:snapshot -- --list\n`);
    process.exit(1);
  }

  const files = readdirSync(dir).filter((f) => f.endsWith(".json") && f !== "manifest.json");
  const statements: string[] = [];
  const report: { table: string; rows: number; dropped: string[]; defaulted: string[] }[] = [];
  const skipped: string[] = [];

  for (const file of files.sort()) {
    const [schema, table] = file.replace(/\.json$/, "").split(".");
    const rows = JSON.parse(readFileSync(join(dir, file), "utf8")) as Record<string, unknown>[];
    if (rows.length === 0) continue;

    const live = columnsOf(schema, table);
    if (live.length === 0) {
      // The table itself is gone. Nothing to restore into, and inventing one
      // would be worse than saying so.
      skipped.push(`${schema}.${table} (table no longer exists)`);
      continue;
    }

    const saved = Object.keys(rows[0]);
    const shared = saved.filter((c) => live.includes(c));
    const dropped = saved.filter((c) => !live.includes(c));
    const defaulted = live.filter((c) => !saved.includes(c));

    if (shared.length === 0) {
      skipped.push(`${schema}.${table} (no columns in common)`);
      continue;
    }

    const cols = shared.map(quote).join(", ");
    // Postgres does the schema adaptation: the cast to the row type ignores
    // keys the table no longer has, and naming only the shared columns lets
    // anything added since fall back to its DEFAULT.
    statements.push(
      `INSERT INTO ${schema}.${quote(table)} (${cols})\n` +
        `SELECT ${cols}\n` +
        `FROM jsonb_populate_recordset(NULL::${schema}.${quote(table)}, $snapshot$${JSON.stringify(
          rows
        )}$snapshot$::jsonb)\n` +
        `ON CONFLICT DO NOTHING;`
    );

    report.push({ table: `${schema}.${table}`, rows: rows.length, dropped, defaulted });
  }

  if (statements.length === 0) {
    console.error("\n  Nothing in that snapshot fits the current schema.\n");
    process.exit(1);
  }

  // replica mode turns off triggers and foreign key checks for this session,
  // so tables can go back in any order and handle_new_user does not fire and
  // create a second profile for every account being restored.
  const sql = [
    "BEGIN;",
    "SET session_replication_role = replica;",
    ...statements,
    "SET session_replication_role = DEFAULT;",
    "COMMIT;",
  ].join("\n\n");

  psqlFile(sql);

  const totalRows = report.reduce((n, r) => n + r.rows, 0);
  console.log(`\nRestored ${totalRows} rows across ${report.length} tables from "${name}"\n`);

  const changed = report.filter((r) => r.dropped.length || r.defaulted.length);
  if (changed.length > 0) {
    console.log("  Schema moved since the snapshot:\n");
    for (const r of changed) {
      if (r.dropped.length) console.log(`    ${r.table}: dropped ${r.dropped.join(", ")}`);
      if (r.defaulted.length) console.log(`    ${r.table}: defaulted ${r.defaulted.join(", ")}`);
    }
    console.log(
      "\n  A rename reads as one dropped and one defaulted column. If any pair\n" +
        "  above is really a rename, the data is in the snapshot file and can be\n" +
        "  moved across by hand.\n"
    );
  }

  if (skipped.length > 0) {
    console.log("  Skipped:\n");
    for (const s of skipped) console.log(`    ${s}`);
    console.log("");
  }
}

function list() {
  if (!existsSync(SNAPSHOT_DIR)) return console.log("\nNo snapshots yet.\n");
  const names = readdirSync(SNAPSHOT_DIR).filter((n) =>
    existsSync(join(SNAPSHOT_DIR, n, "manifest.json"))
  );
  if (names.length === 0) return console.log("\nNo snapshots yet.\n");

  console.log("");
  for (const name of names) {
    const m = JSON.parse(readFileSync(join(SNAPSHOT_DIR, name, "manifest.json"), "utf8"));
    const rows = Object.values(m.tables as Record<string, number>).reduce((a, b) => a + b, 0);
    console.log(`  ${name.padEnd(24)} ${String(rows).padStart(6)} rows   ${m.takenAt}`);
  }
  console.log("");
}

const command = args.find((a) => !a.startsWith("--")) ?? "save";
if (args.includes("--list")) list();
else if (command === "restore") restore();
else save();
