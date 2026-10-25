/**
 * Rehearses the paste, against the project's actual starting state.
 *
 *   node scripts/verify-pending.mjs
 *
 * Applies 0001-0003 — what the live project already has — then
 * `supabase/pending.sql` on top, exactly as pasting it would. Then applies it a
 * second time, because a half-applied migration is the normal way this goes
 * wrong and the recovery is "fix the cause and run it again".
 *
 * `storage` is faked, since 0006 writes to it and only a real Supabase project
 * has it. That means this proves the SQL parses and the ordering holds, not
 * that Supabase Storage will accept the buckets.
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const here = dirname(fileURLToPath(import.meta.url));
const supabase = join(here, "..", "supabase");
const read = (...parts) => readFile(join(supabase, ...parts), "utf8");

/** Enough of Supabase Storage for 0006 to apply. */
const STORAGE_SHIM = `
create schema if not exists storage;
create table if not exists storage.buckets (
  id text primary key, name text, public boolean,
  file_size_limit bigint, allowed_mime_types text[]
);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text, name text, owner uuid
);
alter table storage.objects enable row level security;
create or replace function storage.foldername(p text) returns text[]
language sql immutable as $$
  select (string_to_array(p, '/'))[1:array_length(string_to_array(p, '/'), 1) - 1];
$$;
grant usage on schema storage to anon, authenticated;
`;

async function main() {
  const db = await PGlite.create({ extensions: { btree_gist, pgcrypto } });

  await db.exec(await read("tests", "_shim.sql"));
  await db.exec(STORAGE_SHIM);

  console.log("Applying what the project already has…");
  for (const file of ["0001_schema.sql", "0002_functions.sql", "0003_rls.sql"]) {
    await db.exec(await read("migrations", file));
    console.log(`  ${file}`);
  }

  const pending = await read("pending.sql");

  for (const pass of [1, 2]) {
    try {
      await db.exec(pending);
      console.log(
        pass === 1
          ? "\npending.sql applied cleanly."
          : "pending.sql applied a second time cleanly, so a retry is safe."
      );
    } catch (error) {
      console.error(`\nFAILED on pass ${pass}: ${error.message}`);
      process.exit(1);
    }
  }

  // Spot-check that the things the app calls are actually there now.
  const expected = [
    "resolve_dispute",
    "settle_due_stays",
    "recompute_trust_score",
    "stays_awaiting_review",
    "suspend_member",
    "adjust_points",
    "notify_channels",
  ];
  const { rows } = await db.query(
    `select proname from pg_proc where proname = any($1)`,
    [expected]
  );
  const found = new Set(rows.map((r) => r.proname));
  const missing = expected.filter((name) => !found.has(name));

  const views = await db.query(
    `select viewname from pg_views where viewname in ('member_risk','staff_members')`
  );

  console.log(`\nFunctions present: ${expected.length - missing.length}/${expected.length}`);
  console.log(`Views present: ${views.rows.map((v) => v.viewname).join(", ") || "none"}`);
  const buckets = await db.query("select id from storage.buckets order by id");
  console.log(`Buckets: ${buckets.rows.map((b) => b.id).join(", ") || "none"}`);

  if (missing.length > 0) {
    console.error(`\nMissing: ${missing.join(", ")}`);
    process.exit(1);
  }
  console.log("\nThe paste is safe to run.");
}

main().catch((error) => {
  console.error("\nRunner failed:", error.message);
  process.exit(1);
});
