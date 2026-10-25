/**
 * Runs the SQL scenario against an in-process Postgres.
 *
 *   npm run test:db
 *
 * PGlite is a real Postgres compiled to WebAssembly, so the migrations, the
 * plpgsql, the triggers and the row-level security all execute as they would on
 * the server. It means the database can be tested on any machine with Node,
 * with no Postgres installed and no Docker — which is the difference between
 * these assertions running on every change and running never.
 *
 * Two things differ from a real Supabase project, and the harness papers over
 * both the same way `tests/_shim.sql` does for psql:
 *
 *   - `auth.uid()` and the anon/authenticated roles are faked by the shim.
 *   - `\gset`, `\echo` and `:'var'` are psql client features, not SQL. This
 *     runner implements the few the scenario uses.
 *
 * 0006_storage.sql is skipped: it writes to the `storage` schema, which only
 * Supabase provides.
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const here = dirname(fileURLToPath(import.meta.url));
const supabase = join(here, "..", "supabase");

const MIGRATIONS = [
  "0001_schema.sql",
  "0002_functions.sql",
  "0003_rls.sql",
  "0004_disputes.sql",
  "0005_settlement.sql",
  // 0006_storage.sql needs the Supabase `storage` schema.
  "0007_reviews.sql",
  "0008_moderation.sql",
  "0009_limits_and_location.sql",
  "0010_abuse_signals.sql",
  "0011_notify_channels.sql",
];

const read = (...parts) => readFile(join(supabase, ...parts), "utf8");

/**
 * Splits SQL into statements, respecting dollar-quoted bodies.
 *
 * Every function in these migrations is written as `$$ ... $$`, and a naive
 * split on semicolons would cut them in half.
 */
function statements(sql) {
  const out = [];
  let buffer = "";
  let tag = null;

  for (let i = 0; i < sql.length; i++) {
    const rest = sql.slice(i);

    if (!tag) {
      const open = /^\$([A-Za-z_]*)\$/.exec(rest);
      if (open) {
        tag = open[0];
        buffer += tag;
        i += tag.length - 1;
        continue;
      }
      // Line comments and strings must not be scanned for delimiters.
      if (rest.startsWith("--")) {
        const end = sql.indexOf("\n", i);
        const stop = end === -1 ? sql.length : end;
        buffer += sql.slice(i, stop);
        i = stop - 1;
        continue;
      }
      if (sql[i] === "'") {
        const close = /'(?:[^']|'')*'/.exec(rest);
        const text = close ? close[0] : rest;
        buffer += text;
        i += text.length - 1;
        continue;
      }
      if (sql[i] === ";") {
        if (buffer.trim()) out.push(buffer.trim());
        buffer = "";
        continue;
      }
    } else if (rest.startsWith(tag)) {
      buffer += tag;
      i += tag.length - 1;
      tag = null;
      continue;
    }

    buffer += sql[i];
  }

  if (buffer.trim()) out.push(buffer.trim());
  return out;
}

/**
 * Turns psql meta-commands into something the splitter can handle.
 *
 * They are line-oriented and carry no semicolon, so left alone a `\set` runs
 * together with the statement after it and swallows it. `\set`, `\pset` and
 * `\echo` are dropped — the first two configure psql and the third is
 * decorative, since results are printed from `t_results` at the end. `\gset`
 * becomes a marker inside its own statement, where it survives splitting.
 */
function preprocess(sql) {
  return sql
    .split("\n")
    .filter((line) => !/^\s*\\(set|pset|echo)\b/.test(line))
    .join("\n")
    .replace(/\\gset\s*$/gm, "/*@gset*/;");
}

/** The psql client features the scenario file uses. */
async function runScenario(db, sql) {
  const vars = new Map();
  let failures = 0;
  let aborted = false;

  for (const raw of statements(preprocess(sql))) {
    // Strip leading comments to find the statement itself.
    const text = raw.replace(/^(?:\s*--[^\n]*\n)+/, "").trim();
    if (!text) continue;

    // `select ... as name /*@gset*/` captures a single row into variables.
    const gset = text.includes("/*@gset*/");
    const body = text.replace("/*@gset*/", "").trim();

    // :'name' interpolates a variable as a quoted literal.
    const resolved = body.replace(/:'([A-Za-z_][A-Za-z0-9_]*)'/g, (_, name) => {
      if (!vars.has(name)) throw new Error(`scenario used :'${name}' before setting it`);
      return `'${vars.get(name)}'`;
    });

    let result;
    try {
      result = await db.query(resolved);
    } catch (error) {
      // The scenario ends with a DO block that raises when anything failed.
      // That is its own reporting, and this runner prints the table itself.
      if (/assertion\(s\) failed/.test(error.message)) break;

      // Anything else aborts, exactly as psql with ON_ERROR_STOP would. Say
      // which statement, or it is unfindable in six hundred lines.
      const where = resolved.replace(/\s+/g, " ").slice(0, 200);
      console.error(`\nAborted: ${error.message}\n  in: ${where}`);
      aborted = true;
      break;
    }

    if (gset) {
      const row = result.rows[0] ?? {};
      for (const [key, value] of Object.entries(row)) vars.set(key, value);
    }
  }

  const results = await db.query(
    "select label, ok, detail from t_results order by ctid"
  );
  for (const row of results.rows) {
    if (row.ok) {
      console.log(`  ok   ${row.label}`);
    } else {
      failures++;
      console.log(`  FAIL ${row.label}  <-- ${row.detail}`);
    }
  }

  return { total: results.rows.length, failures, aborted };
}

async function main() {
  const db = await PGlite.create({ extensions: { btree_gist, pgcrypto } });

  console.log("Applying shim and migrations…");
  await db.exec(await read("tests", "_shim.sql"));

  for (const file of MIGRATIONS) {
    try {
      await db.exec(await read("migrations", file));
      console.log(`  applied ${file}`);
    } catch (error) {
      console.error(`\nFailed applying ${file}:\n  ${error.message}`);
      process.exit(1);
    }
  }

  console.log("\nRunning tests/scenario.sql");
  const { total, failures, aborted } = await runScenario(db, await read("tests", "scenario.sql"));

  console.log(
    `\n${total - failures} passed, ${failures} failed, ${total} assertions in total.`
  );
  process.exit(failures > 0 || aborted ? 1 : 0);
}

main().catch((error) => {
  console.error("\nRunner failed:", error.message);
  process.exit(1);
});
