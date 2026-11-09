// Screenshots of the workspace pages as the demo seller, for a visual check after UI changes.
// Run against a running app: SHOTS=<dir> npx tsx --env-file=.env.local scripts/shots-ui.mts [baseUrl] [path ...]
import { openEdge } from "./edge";

const base = process.argv.find((a) => a.startsWith("http")) ?? "http://localhost:3100";
const asked = process.argv.slice(2).filter((a) => a.startsWith("/"));
const paths = asked.length
  ? asked
  : ["/dashboard", "/dashboard/orders", "/dashboard/inbox", "/dashboard/customers", "/dashboard/money", "/dashboard/campaigns", "/dashboard/design", "/dashboard/analytics", "/dashboard/settings"];

const b = await openEdge(base);
try {
  for (const p of paths) {
    await b.go(p, "document.readyState === 'complete' && !!document.querySelector('main')");
    await new Promise((r) => setTimeout(r, 1500));
    await b.shot(`ui${p.replace(/[/?=&]+/g, "-")}`);
    if (b.consoleErrors.length) console.log(`console errors on ${p}:\n  ${b.consoleErrors.splice(0).map((e) => e.slice(0, 300)).join("\n  ")}`);
  }
} finally {
  await b.close();
}
