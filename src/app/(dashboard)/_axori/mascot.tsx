"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import { useEffect, useState } from "react";

/** What Axori AI is doing, as the seller should feel it. Each maps to one face from the emotion set. */
export type MascotState = "idle" | "speaking" | "thinking" | "listening" | "confused" | "surprised";

const FACE: Record<MascotState, string> = {
  idle: "happy",
  speaking: "speaking",
  thinking: "thinking",
  listening: "listening",
  confused: "confused",
  surprised: "surprised",
};

/** Per-state body motion: a breathe while idle, a quicker bob while speaking, a slow tilt while thinking. */
const BODY: Record<MascotState, { y: number[]; rotate: number[]; scale: number[]; duration: number }> = {
  idle: { y: [0, -4, 0], rotate: [0, 0, 0], scale: [1, 1.025, 1], duration: 3.2 },
  speaking: { y: [0, -3, 0, -2, 0], rotate: [0, -2, 0, 2, 0], scale: [1, 1.03, 1, 1.02, 1], duration: 1.1 },
  thinking: { y: [0, -2, 0], rotate: [-4, 4, -4], scale: [1, 1, 1], duration: 2.4 },
  listening: { y: [0, -1, 0], rotate: [0, 0, 0], scale: [1, 1.05, 1], duration: 1.3 },
  confused: { y: [0, 0, 0], rotate: [0, -6, 6, -3, 0], scale: [1, 1, 1], duration: 1.6 },
  surprised: { y: [0, -8, 0], rotate: [0, 0, 0], scale: [1, 1.08, 1], duration: 0.9 },
};

const GLOW: Partial<Record<MascotState, string>> = {
  speaking: "rgba(227,255,72,0.55)",
  listening: "rgba(133,214,166,0.55)",
  thinking: "rgba(227,255,72,0.25)",
  surprised: "rgba(227,255,72,0.45)",
};

/**
 * Axori AI's face. Faces crossfade, the body squashes on each state change, and a glow pulses while it talks or listens.
 * Honours reduced motion: the face still changes, nothing moves.
 */
export function Mascot({ state, size = 48, className = "" }: { state: MascotState; size?: number; className?: string }) {
  const reduce = useReducedMotion();
  const [squash, setSquash] = useState(0);
  const [prev, setPrev] = useState(state);
  // A state change gives the body a quick squash-and-stretch. Counting changes during render, not in an effect.
  if (prev !== state) {
    setPrev(state);
    setSquash((n) => n + 1);
  }
  const body = BODY[state];
  const glow = GLOW[state];
  const src = `/mascot/${FACE[state]}-${size > 96 ? 512 : 256}.webp`;

  return (
    <span className={`relative inline-grid shrink-0 place-items-center ${className}`} style={{ width: size, height: size }} aria-hidden="true">
      {glow && !reduce && (
        <motion.span
          className="absolute inset-[12%] rounded-full blur-md"
          style={{ background: glow }}
          animate={{ opacity: [0.35, 0.9, 0.35], scale: [0.9, 1.15, 0.9] }}
          transition={{ duration: state === "speaking" ? 0.9 : 1.6, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
      <motion.span
        key={squash}
        className="relative block size-full"
        initial={reduce || squash === 0 ? false : { scaleX: 1.12, scaleY: 0.88 }}
        animate={{ scaleX: 1, scaleY: 1 }}
        transition={{ type: "spring", stiffness: 520, damping: 14 }}
      >
        <motion.span
          className="relative block size-full"
          animate={reduce ? undefined : { y: body.y, rotate: body.rotate, scale: body.scale }}
          transition={{ duration: body.duration, repeat: Infinity, ease: "easeInOut" }}
        >
          <AnimatePresence initial={false}>
            <motion.span
              key={state}
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22 }}
            >
              <Image src={src} alt="" width={size} height={size} className="size-full object-contain" priority={size > 96} />
            </motion.span>
          </AnimatePresence>
        </motion.span>
      </motion.span>
    </span>
  );
}

/** Surprise is a reaction, not a mood: it shows for a moment when an approval card arrives, then settles back. */
export function useMomentary(trigger: number, ms = 2200): boolean {
  const [active, setActive] = useState(false);
  const [seen, setSeen] = useState(trigger);
  if (seen !== trigger) {
    setSeen(trigger);
    if (trigger > 0) setActive(true);
  }
  useEffect(() => {
    if (!active) return;
    const id = setTimeout(() => setActive(false), ms);
    return () => clearTimeout(id);
  }, [active, trigger, ms]);
  return active;
}
