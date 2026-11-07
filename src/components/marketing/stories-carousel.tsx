"use client";

import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { motion, useReducedMotion, type PanInfo } from "motion/react";
import Image from "next/image";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { t } from "@/lib/messages";
import { CONTAINER, SECTION, SectionHeading } from "./ui";

const s = t.marketing.home.stories;
const COUNT = s.items.length;
const INTERVAL_MS = 5000;
/** A swipe counts once it travels this far or flicks this fast. */
const SWIPE_PX = 60;
const SWIPE_VELOCITY = 450;

/** Signed distance from the active card, wrapped so the deck loops: -2..2 for five cards. */
function offsetOf(index: number, active: number) {
  let d = index - active;
  if (d > COUNT / 2) d -= COUNT;
  if (d < -COUNT / 2) d += COUNT;
  return d;
}

const fill = (template: string, values: Record<string, number>) =>
  template.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? ""));

/**
 * The reference's fanned deck: centre card upright, neighbours rotated out along an arc.
 * Advances on its own every 5 s, on swipe/drag, on the arrows, the dots, a click on a side card, or the arrow keys.
 * Autoplay pauses on hover, focus, drag and hidden tabs, and is off by default under `prefers-reduced-motion`.
 */
export function StoriesCarousel() {
  const reduce = useReducedMotion();
  const [active, setActive] = useState(0);
  // null = the viewer hasn't chosen; then reduced-motion decides.
  const [choice, setChoice] = useState<boolean | null>(null);
  const playing = choice ?? !reduce;
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [hidden, setHidden] = useState(false);
  const dragged = useRef(false);

  const go = (step: number) => setActive((a) => (a + step + COUNT) % COUNT);

  useEffect(() => {
    const onVisibility = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  const running = playing && !hovered && !focused && !dragging && !hidden;

  // Restart the timer on every slide change so a manual move gets a full interval.
  useEffect(() => {
    if (!running) return;
    const id = window.setTimeout(() => setActive((a) => (a + 1) % COUNT), INTERVAL_MS);
    return () => window.clearTimeout(id);
  }, [running, active]);

  function onDragEnd(_: unknown, info: PanInfo) {
    setDragging(false);
    if (info.offset.x < -SWIPE_PX || info.velocity.x < -SWIPE_VELOCITY) go(1);
    else if (info.offset.x > SWIPE_PX || info.velocity.x > SWIPE_VELOCITY) go(-1);
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      go(-1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      go(1);
    }
  }

  return (
    <section
      aria-roledescription="carousel"
      aria-label={s.label}
      onKeyDown={onKeyDown}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      // Keyboard focus pauses (WAI carousel pattern); a mouse click on a control doesn't.
      onFocus={(e) => e.target.matches(":focus-visible") && setFocused(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node | null) && setFocused(false)}
      className={`${SECTION} overflow-hidden`}
    >
      <div className={CONTAINER}>
        <SectionHeading eyebrow={s.eyebrow} title={s.title} subhead={s.subhead} />
      </div>

      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.18}
        dragSnapToOrigin
        onDragStart={() => {
          dragged.current = true;
          setDragging(true);
        }}
        onDragEnd={onDragEnd}
        onPointerDown={() => {
          dragged.current = false;
        }}
        className="relative mx-auto mt-16 h-[470px] max-w-[1440px] cursor-grab touch-pan-y select-none active:cursor-grabbing sm:h-[560px]"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-[70%] left-1/2 h-[600px] w-[1400px] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(closest-side,rgb(227_255_72/0.10),transparent)]"
        />
        <ul aria-live={running ? "off" : "polite"}>
          {s.items.map((item, i) => {
            const d = offsetOf(i, active);
            const far = Math.abs(d);
            return (
              <li
                key={item.name}
                role="group"
                aria-roledescription="slide"
                aria-label={fill(s.slide, { n: i + 1, total: COUNT })}
                aria-hidden={d !== 0}
                onClick={() => {
                  if (d !== 0 && !dragged.current) setActive(i);
                }}
                style={{
                  transform: `translateX(calc(-50% + ${d} * min(26vw, 400px))) translateY(${far * far * 34}px) rotate(${d * 8}deg) scale(${1 + far * 0.08})`,
                  zIndex: 10 - far,
                }}
                className={`absolute top-0 left-1/2 w-[290px] origin-bottom transition-all duration-500 ease-out motion-reduce:transition-none sm:w-[320px] ${
                  far > 1 ? "hidden md:block" : far === 1 ? "hidden sm:block" : ""
                } ${d !== 0 ? "cursor-pointer" : ""}`}
              >
                <figure className="rounded-[20px] bg-panel-2 p-2 shadow-2xl shadow-black/60">
                  <div className="relative h-[300px] overflow-hidden rounded-2xl sm:h-[340px]">
                    <Image
                      src={`/images/stories/seller-${i + 1}.png`}
                      alt=""
                      fill
                      sizes="320px"
                      draggable={false}
                      className="object-cover object-[50%_80%]"
                    />
                    <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/10 to-transparent" />
                    <blockquote className="relative p-4 font-display text-xl leading-snug font-medium text-cream sm:text-[22px]">
                      “{item.quote}”
                    </blockquote>
                  </div>
                  <figcaption className="flex items-center gap-3 px-2 pt-4 pb-2">
                    <span className="relative size-12 shrink-0 overflow-hidden rounded-full">
                      <Image
                        src={`/images/stories/seller-${i + 1}.png`}
                        alt=""
                        fill
                        sizes="48px"
                        draggable={false}
                        className="scale-[2.2] object-cover object-[50%_62%]"
                      />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-display text-base font-medium text-cream">{item.name}</span>
                      <span className="block text-sm text-stone">{item.role}</span>
                    </span>
                    <span className="ml-auto rounded-md bg-panel-3 px-2 py-1 font-mono text-[10px] text-stone">{s.badge}</span>
                  </figcaption>
                </figure>
              </li>
            );
          })}
        </ul>
      </motion.div>

      <div className="flex flex-col items-center gap-5">
        <div className="flex items-center gap-1">
          {s.items.map((item, i) => {
            const current = i === active;
            return (
              <button
                key={item.name}
                type="button"
                onClick={() => setActive(i)}
                aria-label={fill(s.goTo, { n: i + 1 })}
                aria-current={current ? "true" : undefined}
                className="grid h-11 place-items-center px-1"
              >
                <span
                  className={`relative block h-1.5 overflow-hidden rounded-full transition-all duration-300 ${
                    current ? "w-10 bg-cream/20" : "w-1.5 bg-cream/30 hover:bg-cream/60"
                  }`}
                >
                  {current && (
                    <motion.span
                      key={`${active}-${running}`}
                      className="absolute inset-y-0 left-0 rounded-full bg-lime"
                      initial={{ width: running ? "0%" : "100%" }}
                      animate={{ width: "100%" }}
                      transition={running ? { duration: INTERVAL_MS / 1000, ease: "linear" } : { duration: 0 }}
                    />
                  )}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex justify-center gap-3">
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label={s.prev}
            className="grid size-12 place-items-center rounded-lg bg-panel-3 text-cream transition hover:bg-[#333]"
          >
            <ChevronLeft className="size-6" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setChoice(!playing)}
            aria-label={playing ? s.pause : s.play}
            className="grid size-12 place-items-center rounded-lg bg-panel-3 text-cream transition hover:bg-[#333]"
          >
            {playing ? <Pause className="size-5" aria-hidden="true" /> : <Play className="size-5" aria-hidden="true" />}
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            aria-label={s.next}
            className="grid size-12 place-items-center rounded-lg bg-panel-3 text-cream transition hover:bg-[#333]"
          >
            <ChevronRight className="size-6" aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  );
}
