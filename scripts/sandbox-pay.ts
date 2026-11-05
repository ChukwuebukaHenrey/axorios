// Pays a PayPal sandbox approval link as the sandbox buyer, in headless Edge over CDP. Prints no credentials.
// Imported by the e2e scripts. Needs PAYPAL_SANDBOX_BUYER_EMAIL and PAYPAL_SANDBOX_BUYER_PASSWORD.
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const PORT = 9333;

type Send = (method: string, params?: Record<string, unknown>) => Promise<{ result?: { value?: unknown } }>;

async function connect(): Promise<{ send: Send; close: () => void }> {
  let wsUrl: string | undefined;
  for (let i = 0; i < 40 && !wsUrl; i++) {
    await new Promise((r) => setTimeout(r, 500));
    const targets = await fetch(`http://127.0.0.1:${PORT}/json`).then((r) => r.json() as Promise<{ type: string; webSocketDebuggerUrl: string }[]>).catch(() => []);
    wsUrl = targets.find((t) => t.type === "page")?.webSocketDebuggerUrl;
  }
  if (!wsUrl) throw new Error("Edge did not open a debugging target");
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  let nextId = 1;
  const pending = new Map<number, (v: { result?: { value?: unknown } }) => void>();
  ws.onmessage = (m) => {
    const data = JSON.parse(String(m.data));
    if (data.id && pending.has(data.id)) pending.get(data.id)!(data.result ?? {});
  };
  const send: Send = (method, params = {}) =>
    new Promise((resolve) => {
      const id = nextId++;
      pending.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });
  return { send, close: () => ws.close() };
}

/** Finds the first visible element matching a selector, in the page or a same-origin frame. */
const FIND = `(sel) => {
  const docs = [document, ...[...document.querySelectorAll('iframe')].map(f => { try { return f.contentDocument } catch { return null } }).filter(Boolean)];
  for (const d of docs) for (const el of d.querySelectorAll(sel)) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && !el.disabled) return el;
  }
  return null;
}`;

/** Returns the URL the buyer lands on after paying. Stops at `doneOrigin`, before that page's own redirects matter. */
export async function payAsSandboxBuyer(approveUrl: string, doneOrigin: string): Promise<string> {
  const email = process.env.PAYPAL_SANDBOX_BUYER_EMAIL;
  const password = process.env.PAYPAL_SANDBOX_BUYER_PASSWORD;
  if (!email || !password) throw new Error("Set PAYPAL_SANDBOX_BUYER_EMAIL and PAYPAL_SANDBOX_BUYER_PASSWORD");

  const profile = mkdtempSync(join(tmpdir(), "axorios-edge-"));
  const edge = spawn(
    EDGE,
    ["--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "--window-size=1280,1000", "--no-first-run", "about:blank"],
    { stdio: "ignore" },
  );
  const { send, close } = await connect();
  try {
    await send("Page.enable");
    await send("Page.navigate", { url: approveUrl });

    const evaluate = async <T,>(expression: string) =>
      (await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })).result?.value as T;
    const fill = async (selector: string, value: string) => {
      const ok = await evaluate<boolean>(`(() => { const el = (${FIND})(${JSON.stringify(selector)}); if (!el) return false; el.focus(); el.select?.(); return true; })()`);
      if (ok) await send("Input.insertText", { text: value });
      return ok;
    };
    const click = (selector: string) =>
      evaluate<boolean>(`(() => { const el = (${FIND})(${JSON.stringify(selector)}); if (!el) return false; el.click(); return true; })()`);

    let last = "";
    const deadline = Date.now() + 150_000;
    let emailDone = false;
    let passwordTries = 0;
    let lastPasswordTry = 0;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 1500));
      const here = await evaluate<string>("location.href");
      if (here?.startsWith(doneOrigin)) return here;

      const where = new URL(here || "about:blank");
      if (where.pathname !== last) {
        console.log(`  buyer page: ${where.host}${where.pathname}`);
        last = where.pathname;
      }

      // The first submit can land while the page is still animating in, so try again if the field stays up.
      const passwordDue = passwordTries < 4 && Date.now() - lastPasswordTry > 12_000;
      if (passwordDue && (await fill("input#password, input[name=login_password]", password))) {
        await new Promise((r) => setTimeout(r, 800));
        await click("button#btnLogin, button[name=btnLogin]");
        passwordTries++;
        lastPasswordTry = Date.now();
        continue;
      }
      if (!emailDone && (await fill("input#email, input[name=login_email]", email))) {
        await click("button#btnNext, button[name=btnNext]");
        emailDone = true;
        continue;
      }
      // Cookie banner, then the pay button under its known ids and labels.
      await click("button#acceptAllButton");
      await click("button#payment-submit-btn, [data-id=payment-submit-btn], [data-testid=submit-button-initial], button#consentButton");
    }
    // The page text isn't printed: it can show the buyer's login.
    throw new Error(`Buyer flow timed out at ${last} after ${passwordTries} password tries`);
  } finally {
    close();
    edge.kill();
    await new Promise((r) => setTimeout(r, 500));
    try {
      rmSync(profile, { recursive: true, force: true });
    } catch {
      // Edge can hold the temp profile open for a moment; the OS clears it later.
    }
  }
}
