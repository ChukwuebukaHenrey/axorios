import { loadFont as loadDM } from "@remotion/google-fonts/DMSans";
import { loadFont as loadMono } from "@remotion/google-fonts/GeistMono";

export const FPS = 30;
export const W = 1920;
export const H = 1080;

export const sans = loadDM("normal", { weights: ["400", "500", "700"], subsets: ["latin"] }).fontFamily;
export const mono = loadMono("normal", { weights: ["400", "500"], subsets: ["latin"] }).fontFamily;

// AxoriOS dark theme: lime brand on near-black.
export const C = {
  lime: "#e3ff48",
  limeSoft: "#ecff7a",
  mint: "#85d6a6",
  ink: "#09090b",
  panel: "#111113",
  line: "rgba(255,255,255,0.10)",
  text: "#fafafa",
  muted: "rgba(250,250,250,0.62)",
  // Ebuka's Cake brand kit, sampled from the recording.
  kit: ["#eb4597", "#8a5af6", "#f59b0a", "#1c2638", "#f8f9fe"],
};

/** One backdrop per chapter, as in the reference (each hard cut changes the colour). */
export type Mood = "lime" | "pink" | "navy" | "paypal" | "cream" | "warm" | "black";

export const MOODS: Record<Mood, { base: string; glowA: string; glowB: string; dark: boolean }> = {
  lime: { base: "#07080a", glowA: "rgba(227,255,72,0.30)", glowB: "rgba(133,214,166,0.16)", dark: true },
  pink: { base: "#1a0611", glowA: "rgba(235,69,151,0.55)", glowB: "rgba(138,90,246,0.35)", dark: true },
  navy: { base: "#060b18", glowA: "rgba(64,120,255,0.38)", glowB: "rgba(138,90,246,0.28)", dark: true },
  paypal: { base: "#dfe9f7", glowA: "rgba(0,112,224,0.35)", glowB: "rgba(0,48,135,0.25)", dark: false },
  cream: { base: "#f4ecdc", glowA: "rgba(150,160,60,0.45)", glowB: "rgba(235,69,151,0.18)", dark: false },
  warm: { base: "#0d0907", glowA: "rgba(245,155,10,0.30)", glowB: "rgba(227,255,72,0.14)", dark: true },
  black: { base: "#050506", glowA: "rgba(227,255,72,0.18)", glowB: "rgba(255,255,255,0.06)", dark: true },
};
