// Checks that an env file can be `source`d by bash as well as read by Next: every line is blank, a
// `# comment`, or KEY=value with no space after the `=`. (Pasting a value after the padding in a line
// copied from .env.example, `KEY=   value`, is the usual way this breaks.) Prints line numbers and key names, never values.
// Run: node scripts/check-env.mjs [file]   (defaults to .env.local; exits 1 on any problem)
import { readFileSync } from "node:fs";

const file = process.argv[2] ?? ".env.local";
const problems = [];

readFileSync(file, "utf8")
  .split(/\r?\n/)
  .forEach((line, i) => {
    const n = i + 1;
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line);
    if (!match) return problems.push(`line ${n}: not KEY=value (a note? start it with #)`);
    const [, key, raw] = match;
    // `KEY=   # note` is an empty value plus a comment, which bash accepts (.env.example uses it).
    if (/^\s*(#.*)?$/.test(raw)) return;
    if (/^\s/.test(raw)) return problems.push(`line ${n}: ${key} has a space after "=" (bash reads the rest as a command)`);
    if (/^(["']).*\1\s*(#.*)?$/.test(raw)) return;
    const value = raw.replace(/\s+#.*$/, "");
    if (/\s/.test(value)) problems.push(`line ${n}: ${key} value contains spaces; wrap it in quotes`);
  });

if (problems.length) {
  console.error(`${file}:\n  ${problems.join("\n  ")}`);
  process.exit(1);
}
console.log(`${file}: ok`);
