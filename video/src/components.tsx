import React from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  OffthreadVideo,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { C, MOODS, Mood, mono, sans } from "./theme";

const ease = Easing.bezier(0.22, 1, 0.36, 1);

/** Map frame through keyframes with the house ease (clamped). */
export const kf = (f: number, inp: number[], out: number[]) =>
  interpolate(f, inp, out, { easing: ease, extrapolateLeft: "clamp", extrapolateRight: "clamp" });

export const sec = (s: number) => Math.round(s * 30);

/** Chapter backdrop: base colour, two slow drifting glows and film grain. */
export const Backdrop: React.FC<{ mood: Mood }> = ({ mood }) => {
  const f = useCurrentFrame();
  const m = MOODS[mood];
  const ax = 30 + 8 * Math.sin(f / 90);
  const bx = 72 + 6 * Math.cos(f / 110);
  return (
    <AbsoluteFill style={{ background: m.base, overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(60% 70% at ${ax}% 105%, ${m.glowA} 0%, transparent 70%),
                       radial-gradient(50% 60% at ${bx}% -5%, ${m.glowB} 0%, transparent 70%)`,
        }}
      />
      <AbsoluteFill
        style={{
          opacity: m.dark ? 0.08 : 0.05,
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />
    </AbsoluteFill>
  );
};

type Move = { rx?: [number, number]; ry?: [number, number]; s?: [number, number]; x?: [number, number]; y?: [number, number] };

/**
 * A floating UI panel. The camera never stops: tilt and scale ease from `from` to `to`
 * over the panel's life, like the reference's slow push-ins.
 */
export const Panel: React.FC<{
  w: number;
  h: number;
  move?: Move;
  dur: number;
  radius?: number;
  glow?: string;
  origin?: string;
  zoom?: { at: [number, number]; scale: number; origin: string };
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ w, h, move = {}, dur, radius = 20, glow = "rgba(227,255,72,0.18)", origin = "50% 50%", zoom, children, style }) => {
  const f = useCurrentFrame();
  const p = (r?: [number, number], d = 0) => (r ? kf(f, [0, dur], r) : d);
  const z = zoom ? kf(f, zoom.at, [1, zoom.scale]) : 1;
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", perspective: 2200 }}>
      <div
        style={{
          width: w,
          height: h,
          transformOrigin: origin,
          transform: `translate(${p(move.x)}px, ${p(move.y)}px) rotateX(${p(move.rx)}deg) rotateY(${p(move.ry)}deg) scale(${p(move.s, 1)})`,
          borderRadius: radius,
          overflow: "hidden",
          border: `1px solid ${C.line}`,
          boxShadow: `0 40px 120px rgba(0,0,0,0.55), 0 0 90px ${glow}`,
          background: C.panel,
          ...style,
        }}
      >
        <div style={{ width: "100%", height: "100%", transform: `scale(${z})`, transformOrigin: zoom?.origin ?? "50% 50%" }}>
          {children}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const Clip: React.FC<{ src: string }> = ({ src }) => (
  <OffthreadVideo src={staticFile(src)} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
);

export const Still: React.FC<{ src: string; fit?: "cover" | "contain"; pos?: string }> = ({ src, fit = "cover", pos = "top" }) => (
  <Img src={staticFile(src)} style={{ width: "100%", height: "100%", objectFit: fit, objectPosition: pos }} />
);

/** Browser chrome strip so recordings read as a real browser without showing the URL bar. */
export const BrowserBar: React.FC<{ light?: boolean }> = ({ light }) => (
  <div
    style={{
      height: 34,
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "0 16px",
      background: light ? "#eef1f5" : "#17171a",
      borderBottom: `1px solid ${light ? "#d9dde3" : C.line}`,
    }}
  >
    {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
      <div key={c} style={{ width: 12, height: 12, borderRadius: 6, background: c }} />
    ))}
  </div>
);

/** Short kinetic caption, bottom-left. Words rise in one after another. */
export const Caption: React.FC<{ text: string; delay?: number; dur: number; dark?: boolean }> = ({ text, delay = 8, dur, dark = true }) => {
  const f = useCurrentFrame();
  const words = text.split(" ");
  const out = kf(f, [dur - 12, dur], [1, 0]);
  return (
    <div style={{ position: "absolute", left: 96, bottom: 72, display: "flex", flexWrap: "wrap", gap: "0 14px", maxWidth: 1100, opacity: out }}>
      {words.map((w, i) => {
        const t = f - delay - i * 3;
        return (
          <span
            key={i}
            style={{
              fontFamily: sans,
              fontWeight: 700,
              fontSize: 52,
              letterSpacing: -1.2,
              color: dark ? C.text : "#0b0b0c",
              opacity: kf(t, [0, 10], [0, 1]),
              transform: `translateY(${kf(t, [0, 14], [26, 0])}px)`,
              textShadow: dark ? "0 4px 30px rgba(0,0,0,0.6)" : "none",
            }}
          >
            {w}
          </span>
        );
      })}
    </div>
  );
};

/** Callout chip that springs in. */
export const Chip: React.FC<{
  at: number;
  x: number;
  y: number;
  children: React.ReactNode;
  accent?: string;
  light?: boolean;
  tilt?: number;
}> = ({ at, x, y, children, accent = C.lime, light, tilt = 0 }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f - at, fps, config: { damping: 14, stiffness: 160, mass: 0.7 } });
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: `perspective(1200px) rotateY(${tilt * (1 - s) + tilt * 0.4}deg) scale(${0.6 + 0.4 * s}) translateY(${(1 - s) * 30}px)`,
        opacity: Math.min(1, s * 1.4),
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "16px 24px",
        borderRadius: 18,
        background: light ? "rgba(255,255,255,0.92)" : "rgba(18,18,20,0.86)",
        border: `1px solid ${light ? "rgba(0,0,0,0.08)" : C.line}`,
        boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
        backdropFilter: "blur(12px)",
        fontFamily: sans,
        fontSize: 30,
        fontWeight: 500,
        color: light ? "#0b0b0c" : C.text,
        whiteSpace: "nowrap",
      }}
    >
      <div style={{ width: 12, height: 12, borderRadius: 6, background: accent, boxShadow: `0 0 16px ${accent}` }} />
      {children}
    </div>
  );
};

/** Small mono tag, e.g. "3× speed". */
export const Tag: React.FC<{ at: number; x: number; y: number; children: React.ReactNode }> = ({ at, x, y, children }) => {
  const f = useCurrentFrame();
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        opacity: kf(f - at, [0, 8], [0, 1]),
        fontFamily: mono,
        fontSize: 22,
        color: C.ink,
        background: C.lime,
        borderRadius: 999,
        padding: "6px 14px",
      }}
    >
      {children}
    </div>
  );
};

/** Big glossy 3D cursor (the reference's signature), with a click ripple at `clickAt`. */
export const Cursor: React.FC<{ path: { f: number; x: number; y: number }[]; clickAt?: number }> = ({ path, clickAt }) => {
  const f = useCurrentFrame();
  const fs = path.map((p) => p.f);
  const x = kf(f, fs, path.map((p) => p.x));
  const y = kf(f, fs, path.map((p) => p.y));
  const press = clickAt === undefined ? 1 : kf(f, [clickAt - 3, clickAt, clickAt + 5], [1, 0.82, 1]);
  const r = clickAt === undefined ? 0 : f - clickAt;
  const vis = kf(f, [fs[0], fs[0] + 6], [0, 1]);
  return (
    <>
      {clickAt !== undefined && r > 0 && r < 24 && (
        <div
          style={{
            position: "absolute",
            left: x - 50,
            top: y - 50,
            width: 100,
            height: 100,
            borderRadius: 50,
            border: `3px solid ${C.lime}`,
            transform: `scale(${kf(r, [0, 24], [0.3, 1.8])})`,
            opacity: kf(r, [0, 24], [0.9, 0]),
          }}
        />
      )}
      <svg
        width={92}
        height={92}
        viewBox="0 0 100 100"
        style={{ position: "absolute", left: x - 10, top: y - 6, opacity: vis, transform: `scale(${press}) rotate(-8deg)`, transformOrigin: "10px 6px", filter: "drop-shadow(0 18px 24px rgba(0,0,0,0.5))" }}
      >
        <defs>
          <linearGradient id="cg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="0.45" stopColor="#f3ffb0" />
            <stop offset="1" stopColor="#b8d82a" />
          </linearGradient>
          <linearGradient id="cs" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="rgba(255,255,255,0.9)" />
            <stop offset="1" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
        </defs>
        <path d="M8 4 L84 52 L50 58 L32 92 Z" fill="url(#cg)" stroke="rgba(0,0,0,0.35)" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M12 10 L60 42 L40 46 Z" fill="url(#cs)" opacity="0.7" />
      </svg>
    </>
  );
};

/** Count from 0 to `to`, formatted, over [start, end]. */
export const useCount = (to: number, start: number, end: number) => {
  const f = useCurrentFrame();
  return kf(f, [start, end], [0, to]);
};

export const naira = (n: number, dp = 0) =>
  "₦" + n.toLocaleString("en-NG", { minimumFractionDigits: dp, maximumFractionDigits: dp });
