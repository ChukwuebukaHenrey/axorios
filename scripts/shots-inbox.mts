// Screenshots of the Inbox with the first chat open, desktop (1440) and phone, as the demo seller.
// Run against a running app: SHOTS=<dir> npx tsx --env-file=.env.local scripts/shots-inbox.mts [baseUrl]
import { openEdge } from "./edge";

const base = process.argv.find((a) => a.startsWith("http")) ?? "http://localhost:3100";
const b = await openEdge(base);
try {
  await b.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await b.go("/dashboard/inbox", "!!document.querySelector('main a[href*=\"c=\"]')");
  const href = await b.evaluate<string>("document.querySelector('main a[href*=\"c=\"]').getAttribute('href')");
  await b.go(href, "!!document.querySelector('#seller-reply, [data-template-picker], main section header')");
  await new Promise((r) => setTimeout(r, 1200));
  await b.shot("inbox-open-1440");
  await b.phone();
  await b.go(href, "!!document.querySelector('main section header')");
  await new Promise((r) => setTimeout(r, 1200));
  await b.shot("inbox-open-phone");
  await b.go("/dashboard", "!!document.querySelector('[data-tile=\"Sales\"]')");
  await new Promise((r) => setTimeout(r, 1200));
  await b.shot("home-phone");
} finally {
  b.close();
}
