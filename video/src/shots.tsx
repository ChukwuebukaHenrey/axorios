import React from "react";
import { AbsoluteFill, Img, Sequence, staticFile, useCurrentFrame } from "remotion";
import { Backdrop, BrowserBar, Caption, Chip, Clip, Cursor, Panel, Still, Tag, kf, naira, sec, useCount } from "./components";
import { C, mono, sans } from "./theme";

/** Shot lengths in frames (30 fps). Sum + transitions = under 3:00. */
export const LEN = {
  s1: sec(5),
  s2: sec(8),
  s3: sec(7),
  s4: sec(16),
  s5: sec(13.6),
  s6: sec(7),
  s7: sec(10),
  s8: sec(22.6),
  s9: sec(5),
  s10: sec(14),
  s11: sec(18),
  s12: sec(28),
  s13: sec(10),
};

// AxoriOS.mp4 clips are 1644x872; shown in a 1500-wide browser panel.
const AXW = 1500;
const AXH = Math.round((AXW * 872) / 1644);

const AxPanel: React.FC<{ src: string; dur: number; move?: React.ComponentProps<typeof Panel>["move"]; zoom?: React.ComponentProps<typeof Panel>["zoom"] }> = ({ src, dur, move, zoom }) => (
  <Panel w={AXW} h={AXH + 34} dur={dur} move={move} zoom={zoom}>
    <BrowserBar />
    <div style={{ width: AXW, height: AXH }}>
      <Clip src={src} />
    </div>
  </Panel>
);

/* 1 — Prompt-bar opener (reference 0:00–0:03). */
export const S1: React.FC = () => {
  const f = useCurrentFrame();
  const line = "I bake celebration cakes in Lagos, prices from thirty thousand naira.";
  const typed = line.slice(0, Math.max(0, Math.floor((f - 18) * 1.25)));
  const grow = kf(f, [0, 16], [0.55, 1]);
  const exit = kf(f, [LEN.s1 - 18, LEN.s1], [1, 0.7]);
  const op = kf(f, [0, 10], [0, 1]) * kf(f, [LEN.s1 - 10, LEN.s1], [1, 0]);
  const spin = f * 2.4;
  const pulse = 0.5 + 0.5 * Math.sin(f / 5);
  return (
    <AbsoluteFill>
      <Backdrop mood="lime" />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: op }}>
        <div style={{ transform: `scale(${grow * exit})`, position: "relative", padding: 3, borderRadius: 30, background: `conic-gradient(from ${spin}deg, ${C.lime}, #85d6a6, #f59b0a, ${C.lime})`, boxShadow: `0 0 80px rgba(227,255,72,0.35)` }}>
          <div style={{ width: 1100, minHeight: 170, borderRadius: 28, background: "#0d0e10", padding: "30px 34px 22px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div style={{ fontFamily: sans, fontSize: 38, color: typed ? C.text : C.muted, minHeight: 96, lineHeight: 1.25 }}>
              {typed || "Ask Axori AI anything…"}
              <span style={{ opacity: f % 30 < 15 ? 1 : 0, color: C.lime }}>|</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14 }}>
              <div style={{ fontFamily: mono, fontSize: 20, color: C.muted, display: "flex", gap: 10, alignItems: "center" }}>
                <div style={{ width: 14, height: 14, borderRadius: 7, background: "#ff4d4d", opacity: 0.4 + 0.6 * pulse }} /> Listening…
              </div>
              <div style={{ width: 58, height: 58, borderRadius: 16, background: C.lime, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, color: C.ink, fontWeight: 700 }}>↑</div>
            </div>
          </div>
        </div>
      </AbsoluteFill>
      <Cursor path={[{ f: 60, x: 1700, y: 1000 }, { f: 110, x: 1452, y: 602 }]} clickAt={116} />
    </AbsoluteFill>
  );
};

/* 2 — Landing hero push-in, then glide to "All-in-one selling agent" (reference 0:11–0:13 pull-back, reversed). */
export const S2: React.FC = () => {
  const f = useCurrentFrame();
  const swap = kf(f, [sec(4.2), sec(5.2)], [0, 1]);
  return (
    <AbsoluteFill>
      <Backdrop mood="lime" />
      <Panel w={1600} h={1000} dur={LEN.s2} move={{ rx: [14, 0], s: [0.86, 1] }}>
        <div style={{ position: "relative", width: "100%", height: "100%" }}>
          <div style={{ position: "absolute", inset: 0, opacity: 1 - swap, transform: `translateY(${-swap * 120}px)` }}>
            <Still src="shots/landing-00.jpg" />
          </div>
          <div style={{ position: "absolute", inset: 0, opacity: swap, transform: `translateY(${(1 - swap) * 120}px)` }}>
            <Still src="shots/landing-04.jpg" />
          </div>
        </div>
      </Panel>
      <Caption text="From idea to first paid order" dur={LEN.s2} delay={sec(1)} />
    </AbsoluteFill>
  );
};

/* 3 — Voice note in Axori AI. */
export const S3: React.FC = () => (
  <AbsoluteFill>
    <Backdrop mood="lime" />
    <AxPanel src="clips/c3_voice.mp4" dur={LEN.s3} move={{ rx: [10, 2], ry: [-6, 0], s: [0.92, 1] }} />
    <Tag at={10} x={1560} y={120}>VOICE NOTE · 3× SPEED</Tag>
    <Caption text="Just say what you sell" dur={LEN.s3} />
  </AbsoluteFill>
);

/* 4 — Step 1: the brand kit card. Plays 6 s, then holds while the camera pushes in on the card. */
export const S4: React.FC = () => {
  const swatchAt = sec(7);
  return (
    <AbsoluteFill>
      <Backdrop mood="lime" />
      <AxPanel
        src="clips/c4_brand.mp4"
        dur={LEN.s4}
        move={{ rx: [4, 0], x: [0, -150] }}
        zoom={{ at: [sec(5.5), sec(9)], scale: 1.55, origin: "56% 30%" }}
      />
      <div style={{ position: "absolute", left: 1330, top: 250, display: "flex", flexDirection: "column", gap: 22 }}>
        <Sequence from={0} layout="none">
          <Chip at={sec(7)} x={0} y={0} tilt={-14}>
            <span style={{ display: "flex", gap: 8 }}>
              {C.kit.map((c, i) => (
                <PopSwatch key={c} c={c} at={swatchAt + 4 + i * 4} />
              ))}
            </span>
          </Chip>
          <Chip at={sec(8.2)} x={0} y={96} tilt={-14}>Outfit / Plus Jakarta Sans</Chip>
          <Chip at={sec(9.4)} x={0} y={192} tilt={-14}>Warm, friendly, inviting</Chip>
          <Chip at={sec(10.6)} x={0} y={288} tilt={-14}>Name ideas included</Chip>
        </Sequence>
      </div>
      <Caption text="One voice note → a brand kit" dur={LEN.s4} />
    </AbsoluteFill>
  );
};

const PopSwatch: React.FC<{ c: string; at: number }> = ({ c, at }) => {
  const f = useCurrentFrame();
  const s = kf(f, [at, at + 8], [0, 1]);
  return <div style={{ width: 34, height: 34, borderRadius: 9, background: c, border: "1px solid rgba(255,255,255,0.3)", transform: `scale(${s})` }} />;
};

/* 5 — Step 2: rename and price by just asking; the wait is sped up. */
export const S5: React.FC = () => (
  <AbsoluteFill>
    <Backdrop mood="lime" />
    <AxPanel src="clips/c5_rename.mp4" dur={LEN.s5} move={{ rx: [0, 6], ry: [0, 5], s: [1, 0.96] }} />
    <Chip at={sec(8.4)} x={1250} y={170} tilt={-12}>
      Signature Cake · <span style={{ fontFamily: mono, color: C.lime }}>₦50,000</span>
    </Chip>
    <Tag at={sec(8)} x={240} y={140}>3× SPEED</Tag>
    <Caption text="Change anything by asking" dur={LEN.s5} />
  </AbsoluteFill>
);

/* 6 — The Publish approval card. Kept flat so the click lands on the button. */
export const S6: React.FC = () => (
  <AbsoluteFill>
    <Backdrop mood="lime" />
    <AxPanel src="clips/c6_publish.mp4" dur={LEN.s6} zoom={{ at: [0, 50], scale: 1.5, origin: "50% 70%" }} />
    <Cursor path={[{ f: 8, x: 1400, y: 1040 }, { f: 52, x: 966, y: 800 }]} clickAt={57} />
    <Caption text="Live only when you approve" dur={LEN.s6} delay={sec(2.4)} />
  </AbsoluteFill>
);

/* 7 — Hard cut: the live storefront on its own colour. */
export const S7: React.FC = () => (
  <AbsoluteFill>
    <Backdrop mood="pink" />
    <Panel w={AXW} h={AXH + 34} dur={LEN.s7} move={{ ry: [-10, 4], rx: [4, 0], s: [0.94, 1] }} glow="rgba(235,69,151,0.4)">
      <BrowserBar light />
      <div style={{ width: AXW, height: AXH }}>
        <Clip src="clips/c7_store.mp4" />
      </div>
    </Panel>
    <Caption text="A designed storefront. No code." dur={LEN.s7} />
  </AbsoluteFill>
);

/* 8 — Hard cut: Telegram, the buyer side (step 4 in the script; it comes first in the take). */
export const S8: React.FC = () => {
  const h = 930;
  const w = Math.round((h * 850) / 960);
  return (
    <AbsoluteFill>
      <Backdrop mood="navy" />
      <AbsoluteFill style={{ transform: "translateX(-330px)" }}>
        <Panel w={w} h={h} dur={LEN.s8} move={{ ry: [16, 6], rx: [4, 0], s: [0.95, 1] }} radius={34} glow="rgba(64,120,255,0.35)">
          <Clip src="clips/c8_telegram.mp4" />
        </Panel>
      </AbsoluteFill>
      <Chip at={sec(2.5)} x={1080} y={250} accent="#6ea8ff" tilt={-16}>Replies in Pidgin</Chip>
      <Chip at={sec(8.5)} x={1080} y={360} accent="#6ea8ff" tilt={-16}>Prices from the real catalogue</Chip>
      <Chip at={sec(16.5)} x={1080} y={470} accent="#6ea8ff" tilt={-16}>
        Total <span style={{ fontFamily: mono }}>₦102,000</span> → PayPal link
      </Chip>
      <Tag at={10} x={1080} y={180}>SPED UP</Tag>
      <Caption text="Sells in chat, in their language" dur={LEN.s8} delay={sec(1)} />
    </AbsoluteFill>
  );
};

/* 9 — Hard cut: PayPal sandbox checkout. */
export const S9: React.FC = () => {
  const w = 1560;
  const h = Math.round((w * 960) / 1832);
  return (
    <AbsoluteFill>
      <Backdrop mood="paypal" />
      <Panel w={w} h={h + 34} dur={LEN.s9} move={{ rx: [8, 0], s: [0.95, 1] }} glow="rgba(0,112,224,0.3)">
        <BrowserBar light />
        <div style={{ width: w, height: h }}>
          <Clip src="clips/c9_paypal.mp4" />
        </div>
      </Panel>
      <Tag at={6} x={180} y={70}>PAYPAL SANDBOX</Tag>
      <Caption text="Paid through PayPal" dur={LEN.s9} dark={false} />
    </AbsoluteFill>
  );
};

/* 10 — The paid order page, with the naira-to-dollar callout counting up. */
export const S10: React.FC = () => {
  const w = 1180;
  const h = Math.round((w * 980) / 1832);
  const ngn = useCount(102000, sec(4), sec(7));
  const usd = useCount(75.58, sec(7.2), sec(9.2));
  const f = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Backdrop mood="cream" />
      <AbsoluteFill style={{ transform: "translateX(-300px)" }}>
        <Panel w={w} h={h + 34} dur={LEN.s10} move={{ ry: [12, 4], s: [0.95, 1] }} glow="rgba(150,160,60,0.3)">
          <BrowserBar light />
          <div style={{ width: w, height: h }}>
            <Clip src="clips/c10_paid.mp4" />
          </div>
        </Panel>
      </AbsoluteFill>
      <div
        style={{
          position: "absolute",
          left: 1250,
          top: 300,
          width: 560,
          padding: "34px 38px",
          borderRadius: 26,
          background: "#ffffff",
          boxShadow: "0 30px 80px rgba(60,50,20,0.25)",
          fontFamily: sans,
          color: "#111",
          opacity: kf(f, [sec(3.4), sec(4)], [0, 1]),
          transform: `perspective(1200px) rotateY(${kf(f, [sec(3.4), sec(5)], [-24, -8])}deg)`,
        }}
      >
        <div style={{ fontSize: 24, color: "#6b6b6b" }}>Store total</div>
        <div style={{ fontFamily: mono, fontSize: 64, fontWeight: 500, letterSpacing: -2 }}>{naira(Math.round(ngn))}</div>
        <div style={{ height: 1, background: "#e6e1d6", margin: "22px 0" }} />
        <div style={{ fontSize: 24, color: "#6b6b6b" }}>Charged through PayPal</div>
        <div style={{ fontFamily: mono, fontSize: 64, fontWeight: 500, letterSpacing: -2, color: "#003087" }}>${usd.toFixed(2)}</div>
        <div style={{ fontFamily: mono, fontSize: 20, color: "#6b6b6b", marginTop: 10, opacity: kf(f, [sec(9.4), sec(10)], [0, 1]) }}>
          1 NGN = 0.000741 USD · shown before paying
        </div>
      </div>
      <Caption text="Priced in naira. Paid in dollars." dur={LEN.s10} dark={false} delay={sec(1)} />
    </AbsoluteFill>
  );
};

/* 11 — Steps 5–6 from the real landing feature sections, tilted cards drifting (reference 0:13–0:21). */
export const S11: React.FC = () => {
  const beat = LEN.s11 / 3;
  const items = [
    { src: "shots/features-02.jpg", cap: "On-brand posts, scheduled" },
    { src: "shots/landing-10.jpg", cap: "Nothing posts until you approve" },
    { src: "shots/landing-13.jpg", cap: "One-tap Shopify sync", zoom: 1.3 },
  ];
  return (
    <AbsoluteFill>
      <Backdrop mood="warm" />
      {items.map((it, i) => (
        <Sequence key={it.src} from={Math.round(i * beat)} durationInFrames={Math.round(beat)}>
          <Panel w={1500} h={938} dur={Math.round(beat)} move={{ ry: [i % 2 ? 14 : -14, i % 2 ? 4 : -4], rx: [8, 2], s: [0.9, 0.98] }} glow="rgba(245,155,10,0.25)">
            <div style={{ width: "100%", height: "100%", transform: `scale(${"zoom" in it ? it.zoom : 1})`, transformOrigin: "50% 0%" }}>
              <Still src={it.src} />
            </div>
          </Panel>
          <Caption text={it.cap} dur={Math.round(beat)} delay={6} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

/* 12 — Tour: the demo store's real numbers count up on tilted cards. */
export const S12: React.FC = () => {
  const half = sec(14);
  return (
    <AbsoluteFill>
      <Backdrop mood="black" />
      <Sequence durationInFrames={half}>
        <Panel w={1531} h={815} dur={half} move={{ rx: [16, 6], ry: [-8, 0], s: [0.88, 0.96], y: [40, -10] }}>
          <Still src="stills/dash-home.webp" />
        </Panel>
        <Stat at={sec(1.5)} x={110} y={150} label="Sales · 30 days" to={15556209.53} dp={2} money />
        <Stat at={sec(3)} x={1380} y={620} label="Orders to fulfil" to={47} />
        <Caption text="Everything in one place" dur={half} delay={sec(1)} />
      </Sequence>
      <Sequence from={half}>
        <Panel w={1528} h={811} dur={LEN.s12 - half} move={{ rx: [6, 0], ry: [8, 0], s: [0.92, 1] }}>
          <Still src="stills/dash-store.webp" />
        </Panel>
        <Stat at={sec(1)} x={120} y={120} label="Orders" to={317} />
        <Stat at={sec(2)} x={560} y={80} label="Store visits" to={11204} />
        <Stat at={sec(3)} x={1000} y={120} label="Conversion" to={2.8} dp={1} suffix="%" />
        <Caption text="Every number reconciled with PayPal" dur={LEN.s12 - half} delay={sec(1)} />
      </Sequence>
    </AbsoluteFill>
  );
};

const Stat: React.FC<{ at: number; x: number; y: number; label: string; to: number; dp?: number; money?: boolean; suffix?: string }> = ({ at, x, y, label, to, dp = 0, money, suffix = "" }) => {
  const f = useCurrentFrame();
  const v = useCount(to, at + 4, at + sec(2.2));
  const vis = kf(f, [at, at + 10], [0, 1]);
  const val = money ? naira(v, dp) : v.toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp }) + suffix;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        padding: "26px 34px",
        borderRadius: 24,
        background: "rgba(17,17,19,0.9)",
        border: `1px solid ${C.line}`,
        boxShadow: "0 30px 80px rgba(0,0,0,0.6), 0 0 50px rgba(227,255,72,0.12)",
        fontFamily: sans,
        opacity: vis,
        transform: `perspective(1400px) rotateX(${kf(f, [at, at + sec(1.5)], [30, 8])}deg) rotateY(-10deg) translateY(${(1 - vis) * 40}px)`,
      }}
    >
      <div style={{ fontSize: 24, color: C.muted }}>{label}</div>
      <div style={{ fontSize: 68, fontWeight: 700, letterSpacing: -2, color: C.text }}>{val}</div>
    </div>
  );
};

/* 13 — End card. */
export const S13: React.FC = () => {
  const f = useCurrentFrame();
  const s = kf(f, [0, 24], [0.8, 1]);
  return (
    <AbsoluteFill>
      <Backdrop mood="lime" />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 30, opacity: kf(f, [LEN.s13 - 15, LEN.s13], [1, 0]) }}>
        <Img src={staticFile("brand/logo.png")} style={{ width: 170, height: 170, transform: `scale(${s})`, filter: "drop-shadow(0 0 60px rgba(227,255,72,0.45))" }} />
        <div style={{ fontFamily: sans, fontWeight: 700, fontSize: 120, letterSpacing: -4, color: C.text, opacity: kf(f, [8, 22], [0, 1]) }}>AxoriOS</div>
        <div style={{ fontFamily: sans, fontSize: 46, color: C.muted, opacity: kf(f, [20, 34], [0, 1]) }}>From idea to first paid order.</div>
        <div style={{ fontFamily: mono, fontSize: 28, color: C.ink, background: C.lime, padding: "10px 22px", borderRadius: 999, opacity: kf(f, [34, 46], [0, 1]) }}>
          Built on PayPal · axorios.vercel.app
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
