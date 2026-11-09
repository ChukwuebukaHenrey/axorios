/**
 * Restores the demo account in one command (spec v2): deletes the demo stores' import and seed rows, regenerates
 * them, then runs the checks. Keeps product IDs, Shopify mappings and real sandbox orders (source 'app').
 * Run before recording and before judging opens on 1 Dec:
 *   npx tsx scripts/reset-demo.mts
 */
import { spawnSync } from "node:child_process";

const run = (script: string, ...flags: string[]) =>
  spawnSync(process.execPath, ["--import", "tsx", ...flags, "--env-file=.env.local", script], { stdio: "inherit" }).status ?? 1;

const seeded = run("scripts/seed-v2.mts", "--import", "./scripts/no-server-only.mjs");
process.exit(seeded === 0 ? run("scripts/check-demo.mts") : seeded);
