/**
 * A production build that does not disturb a running dev server.
 *
 *   npm run build:check
 *
 * `next build` and `next dev` share `.next`, and the build rewrites it while
 * the dev server is still serving from it: the manifest then points at chunks
 * that have been replaced, and the browser gets a ChunkLoadError on the next
 * navigation. It looks like a code fault and is not one.
 *
 * This sends the output to `.next-check` instead, through the `NEXT_DIST_DIR`
 * hook in next.config.ts. Use it to verify a change compiles while somebody
 * has `npm run dev` open; `npm run build` is still the one to deploy.
 *
 * A wrapper rather than an inline environment variable because `VAR=x cmd`
 * does not work in cmd.exe or PowerShell, and this has to run everywhere.
 */
import { spawn } from "node:child_process";

const child = spawn("npx", ["next", "build"], {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, NEXT_DIST_DIR: ".next-check" },
});

child.on("exit", (code) => process.exit(code ?? 1));
