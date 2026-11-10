// Headless Edge over the DevTools protocol, signed in as the demo seller. Shared by the e2e page checks.
// Prints no credentials.
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";

export function check(ok: unknown, label: string) {
  if (!ok) throw new Error(`FAIL ${label}`);
  console.log(`PASS ${label}`);
}

export async function demoSellerCookie() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const ref = new URL(url).hostname.split(".")[0];
  const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const { data, error } = await anon.auth.signInWithPassword({ email: process.env.DEMO_SELLER_EMAIL!, password: process.env.DEMO_SELLER_PASSWORD! });
  if (error || !data.session) throw new Error(`Sign-in failed: ${error?.code}`);
  const name = `sb-${ref}-auth-token`;
  const value = `base64-${Buffer.from(JSON.stringify(data.session)).toString("base64url")}`;
  return { name, value, header: `${name}=${value}` };
}

export async function openEdge(base: string, port = 9335) {
  const shots = process.env.SHOTS ?? tmpdir();
  const cookie = await demoSellerCookie();
  const profile = mkdtempSync(join(tmpdir(), "axorios-e2e-"));
  const edge = spawn(EDGE, ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--window-size=1280,900", "--no-first-run", "about:blank"], { stdio: "ignore" });

  let wsUrl: string | undefined;
  for (let i = 0; i < 40 && !wsUrl; i++) {
    await new Promise((r) => setTimeout(r, 500));
    const targets = await fetch(`http://127.0.0.1:${port}/json`).then((r) => r.json() as Promise<{ type: string; webSocketDebuggerUrl: string }[]>).catch(() => []);
    wsUrl = targets.find((t) => t.type === "page")?.webSocketDebuggerUrl;
  }
  if (!wsUrl) throw new Error("Edge did not open");
  const ws = new WebSocket(wsUrl);
  await new Promise((r, j) => ((ws.onopen = r), (ws.onerror = j)));
  let nextId = 1;
  const pending = new Map<number, (v: Record<string, unknown>) => void>();
  const consoleErrors: string[] = [];
  ws.onmessage = (m) => {
    const data = JSON.parse(String(m.data));
    if (data.id && pending.has(data.id)) pending.get(data.id)!(data.result ?? {});
    if (data.method === "Runtime.exceptionThrown") consoleErrors.push(data.params.exceptionDetails?.exception?.description ?? "exception");
    if (data.method === "Runtime.consoleAPICalled" && data.params.type === "error") consoleErrors.push(String(data.params.args?.[0]?.value ?? ""));
  };
  const send = (method: string, params: Record<string, unknown> = {}) =>
    new Promise<Record<string, unknown>>((resolve) => {
      const id = nextId++;
      pending.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });
  const evaluate = async <T,>(expression: string): Promise<T> =>
    ((await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })).result as { value: T }).value;
  const waitFor = async (expression: string, ms = 20_000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      if (await evaluate<boolean>(expression).catch(() => false)) return true;
      await new Promise((r) => setTimeout(r, 250));
    }
    return false;
  };
  const go = async (path: string, ready = "document.readyState === 'complete'") => {
    await send("Page.navigate", { url: `${base}${path}` });
    await new Promise((r) => setTimeout(r, 300));
    // A route's loading.tsx skeleton (aria-busy) shows first; wait until the real page has replaced it.
    return waitFor(`(${ready}) && !document.querySelector('[aria-busy="true"]')`, 30_000);
  };
  const shot = async (name: string) => {
    const { data } = (await send("Page.captureScreenshot", { format: "png" })) as { data: string };
    const file = join(shots, `${name}.png`);
    writeFileSync(file, Buffer.from(data, "base64"));
    console.log(`shot ${file}`);
  };
  const phone = () => send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Network.enable");
  await send("Network.setCookie", { name: cookie.name, value: cookie.value, url: base, path: "/" });

  return {
    send,
    evaluate,
    waitFor,
    go,
    shot,
    phone,
    cookie,
    consoleErrors,
    close: () => {
      ws.close();
      edge.kill();
    },
  };
}
